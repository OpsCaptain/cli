var cli = require('../occ'),
    fs = require('fs'),
    path = require('path'),
    fsfuncs = require('../fsfuncs'),
    archiver = require('archiver'),
    request = require('request'),
    status = require('../deploymentstatus'),
    endpoints = require('../endpoints'),
    remote = require('../remotecommon'); 

var OC_BUNDLE_FILENAME = '__ocbundle__.zip',
    OC_ASSET_STATE_NEW = 1,
    OC_IGNORE = '.ocignore',
    OC_REMOTE_DELETIONS_FILENAME = '__ocremote_delete__',
    OC_ASSET_STATE_MODIFIED = 2,
    OC_ASSET_UNCHANGED = 3,
    OC_DEPLOY_ENDPOINT = endpoints.deploy; 


function recursivelyAddToArchive(base_dir, p_array, tracker, is_base_dir, ignore_set) {

    var key_prefix = p_array.join('/');
    var files = fs.readdirSync(base_dir); 
    
    for (var i = 0, ii = p_array.length; i < files.length; i++) {
        if (files[i] == OC_BUNDLE_FILENAME) continue;

        if (is_base_dir && ignore_set && ignore_set.hasOwnProperty(files[i]))
            continue;

        var fs_asset = path.join(base_dir, files[i]);

        if (fs.lstatSync(fs_asset).isDirectory()) {

            p_array.push(files[i]);
            recursivelyAddToArchive(fs_asset, p_array, tracker, false); 
            p_array.splice(ii, 1);
        }
        else {
            var key = key_prefix != "" ? key_prefix + '/' + files[i] : files[i];
            var stat = fs.statSync(fs_asset);
            var mt = stat.mtime.toString();

            if (tracker.hasOwnProperty(key)) {
                
                var last_modified_tracked = tracker[key];
                last_modified_tracked.exists = true;;

                if (last_modified_tracked.mt != mt) {
                    last_modified_tracked.mt = mt;
                    last_modified_tracked.state = OC_ASSET_STATE_MODIFIED;
                    tracker[key] = last_modified_tracked;
                }
            }
            else {
                tracker[key] = { mt : mt, exists : true, state : OC_ASSET_STATE_NEW, path : fs_asset };
            }
        }
    }
}

function deploy(bundle_path, app_name, meta_data, unlink) {
    var id = cli.randomId();
    var request_path = OC_DEPLOY_ENDPOINT;
    meta_data['deployid'] = id;
    meta_data['appid'] = app_name;

    cli.writeline('Lift off!');
    console.log(''); 

    request.post({
        url: request_path,
        headers : remote.getRequestHeaders(),
        formData: {
            deployinfo: JSON.stringify(meta_data),
            deploycode: {
                value: fs.createReadStream(bundle_path),
                options: {
                    filename: OC_BUNDLE_FILENAME,
                    contentType: 'aapplication/zip'
                }
            }
        }
    }, function (err, res, body) {
        if (err) {
            cli.writeerror(err); 
        }

        if (unlink)
            fs.unlinkSync(bundle_path); 
    });

    // start polling for the status update..
    var prog = new status(id, app_name);
    prog.startPolling(); 
}

function Package(binary_path, environment_file, application_name, roll_update_on_url_ping, roll_update_after_wait) {
    cli.writeline('Using application directory ' + cli.writevariable(binary_path));

    if (!fs.existsSync(binary_path)) {
        cli.writeerror('The specified directoy (' + binary_path + ') to be deployed does not exist');
        process.exit(1);
    }

    var environment = {};

    if (environment_file != null) {
        var environment_path = path.join(binary_path, environment_file);
        if (!fs.existsSync(environment_path)) {
            environment_path = environment_file;
            if (!fs.existsSync(environment_path)) {
                cli.writeerror('The specified file ' + cli.writevariable(environment_file) + ' cannot be found');
                return;
            }
        }

        environment = fsfuncs.ObjectFromFile(environment_path);
        if (environment == null) {
            cli.writeerror('Invalid JSON in environment variables file ' + cli.writevariable(environment_file));
        }
    }

    if (!fs.lstatSync(binary_path).isDirectory()) {
        if (!(binary_path.endsWith(".zip")
            || binary_path.endsWith(".tgz")
            || binary_path.endsWith(".tar.gz")
            || binary_path.endsWith(".jar")
            || binary_path.endsWith(".war"))) {
            cli.writeerror('Acceptable file formats to deploy include: [.zip], [.tgz], [.tar.gz], [.jar] and [.war]');
            return;
        }
        deploy(binary_path, application_name, {
            spurl: roll_update_on_url_ping,
            swait: roll_update_after_wait,
            incremental: "0",
            env: environment
        }, false);
        return;
    }

    var changes_track_file = __dirname + '/' + application_name + '.json';
    var obj = {};

    /*
    * Disable incremental deployment for now.
    *
    if (reset_tracking) {
        obj = {};
    }
    else {
        obj = fsfuncs.ObjectFromFile(changes_track_file);
        if (obj == null) {
            obj = {};
        }
        else {
            for (var s in obj) {
                var o = obj[s];
                o.exists = false;
                o.state = OC_ASSET_UNCHANGED;
            }
        }
    }
    */

    var ignore_file = path.join(binary_path, OC_IGNORE),
        ignore_set = {
            '.git': 1,
            '.ocignore': 1
        };//put ignore files in a dict for easy lookup

    if (fs.existsSync(ignore_file)) {
        var ignore_file = fs.readFileSync(ignore_file, { encoding: 'utf8' });
        ignore_file = ignore_file.trim();

        var set = ignore_file.split("\n");
        for (var i = 0 ; i < set.length; i++) {
            var v = set[i].trim();
            if (v.length > 0 && !ignore_set.hasOwnProperty(v)) {
                if (v.charAt(v.length - 1) == '\r') {
                    v = v.substring(0, v.length - 1);
                }

                ignore_set[v] = 1; 
            }
        }
    }

    for (var s in ignore_set)
        cli.writeline('Ignore file or directory with name: ' + cli.writevariable(s)); 

    recursivelyAddToArchive(binary_path, [], obj, true, ignore_set);

    var remote_delete = [], changes = {}, has_changes = false;

    for (var s in obj) {
        var o = obj[s];
        if (s == OC_REMOTE_DELETIONS_FILENAME) {
            cli.writeerror('Cannot name file using reserved name ' + cli.writevariable(OC_REMOTE_DELETIONS_FILENAME));
            return;
        }
        if (!o.exists) {
            cli.debug('Remote must delete file: ' + cli.writevariable(s));
            remote_delete.push(s);
            has_changes = true;
        }
        else {
            if (o.state == OC_ASSET_STATE_NEW) {
                has_changes = true;
                cli.debug('Remote accept new file: ' + cli.writevariable(s));
                changes[s] = o;
            }
            else if (o.state == OC_ASSET_STATE_MODIFIED) {
                has_changes = true;
                changes[s] = o;
                cli.debug('Remote overwrite existing file: ' + cli.writevariable(s));
            }
        }
    }

    if (!has_changes) {
        cli.writeline('Nothing has changed since you last deployed');
        return;
    }

    var bundle_path = path.join(binary_path, OC_BUNDLE_FILENAME);
    if (fs.existsSync(bundle_path))
        fs.unlinkSync(bundle_path);

    var output = fs.createWriteStream(bundle_path);
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });

    output.on('close', function () {
        cli.writeline('Length of zip archive in bytes: [' + archive.pointer() + ']');
       // fs.writeFileSync(changes_track_file, JSON.stringify(obj));

        deploy(bundle_path, application_name, {
            spurl: roll_update_on_url_ping,
            swait: roll_update_after_wait,
            incremental: "1",
            env: environment
        }, true);
    });


    output.on('end', function () {

    });


    archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
            // user somehow managed to delete file as archiving was happening..
        } else {
            cli.writeerror(err.toString())
            fs.fs.unlinkSync(bundle_path);
            process.exit(1);
        }
    });

    archive.on('error', function (err) {
        cli.writeerror(err.toString())
        fs.fs.unlinkSync(bundle_path);
        process.exit(1);
    });

    archive.pipe(output);

    cli.writeline('Creating zip archive'); 

    for (var s in changes)
        archive.append(fs.createReadStream(changes[s].path), { name: s });

    if (remote_delete.length > 0)
        archive.append(JSON.stringify(remote_delete), { name: OC_REMOTE_DELETIONS_FILENAME });

    archive.finalize();
}

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return; 

    if (!args || !args.length) {
        cli.missingArgs(); 
        return; 
    }

    var cdir = process.cwd(), binary_path = cdir, application_name = null, app_id = null, environment_file = null, reset_tracking = false,
        roll_update_on_url_ping = '', // specify a url which ocagent must ping against the new container to confirm the old container can be gced
        roll_update_after_wait = 3; // require ocagent to wait for x amount of seconds for the new container to boot before gcing the old container.

    for (var i = 0, v; i < args.length; i += 2) {
        switch (args[i]) {
            case '-p':
                binary_path = cli.nextArg(args, i);
                break;
            case '-i':
                app_id = cli.nextArg(args, i); 
                break; 
            case '-n':
                application_name = cli.nextArg(args, i);
                break;
            case '-e':
                environment_file = cli.nextArg(args, i); 
                break;
            case '--rs':
                reset_tracking = true; 
                break; 
            case '-spurl':
                roll_update_on_url_ping = cli.nextArg(args, i); 
                break;
            case '-swait':
                roll_update_after_wait = cli.nextIntArg(args, i);
                if (roll_update_after_wait > 120) {
                    cli.writeerror('-swait expects a value between [0 and 120] seconds.'); 
                }
                break;
            default:
                cli.errors.unknownSwitch(args[i], 'deploy'); 
                return; 
        }
    }

    remote.resolveAppId(application_name, app_id, 'deploy', function (id) {
        cli.debug('Deploy to application with id ' + cli.writevariable(id));

        Package(binary_path, environment_file, id, roll_update_on_url_ping, roll_update_after_wait);
    });
}

module.exports = HandleRequest;