var cli = require('../occ'),
    fs = require('fs'),
    path = require('path'),
    fsfuncs = require('../fsfuncs'),
    archiver = require('archiver'),
    request = require('request'),
    status = require('../deploymentstatus'),
    endpoints = require('../endpoints'),
    remote = require('../remotecommon'), 
    spawn = require('child_process').spawn; 

var OC_BUNDLE_FILENAME = '__ocbundle__.zip',
    OC_ASSET_STATE_NEW = 1,
    OC_IGNORE = fsfuncs.constants.OC_IGNORE,
    OC_REMOTE_DELETIONS_FILENAME = '__ocremote_delete__',
    OC_ASSET_STATE_MODIFIED = 2,
    OC_ASSET_UNCHANGED = 3,
    OC_DEPLOY_ENDPOINT = endpoints.deploy,
    OC_DETECT_METEOR = '.meteor/release',
    OC_MANIFEST = fsfuncs.constants.OC_MANIFEST;;


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

function deploy(bundle_path, app_name, oc_env, unlink) {
    var id = cli.randomId();
    var request_path = OC_DEPLOY_ENDPOINT;

    var meta_data = {
        buildpack: oc_env.buildpack
    }

    if (oc_env.rollupdateaftersecs)
        meta_data['rollupdateaftersecs'] = oc_env.rollupdateaftersecs;

    if (oc_env.rollupdatepingsuccess)
        meta_data['rollupdatepingsuccess'] = '1';


    if (oc_env.env)
        meta_data['env'] = oc_env.env; 

    meta_data['deployid'] = id;
    meta_data['appid'] = app_name;

    cli.writeline('Binary info: ' + JSON.stringify(meta_data, null, 2)); 
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
                    contentType: 'application/zip'
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

function resolveJsonFile(binary_path, use_path) {
    var file_path = path.join(binary_path, use_path);
    if (!fs.existsSync(file_path)) {
        file_path = use_path; 
        if (!fs.existsSync(file_path)) {
            cli.writeerror('The specified file ' + cli.writevariable(use_path) + ' cannot be found');
            return;
        }
    }

    var jobject = fsfuncs.ObjectFromFile(file_path);
    if (jobject == null) {
        cli.writeerror('Invalid JSON in file ' + cli.writevariable(use_path));
    }

    return jobject;
}

function MeteorBuild(binary_path, app_id, environment, cb) {
    var buildOptions = environment.meteorbuild;
    var args = [];

    var executable = buildOptions.executable || 'meteor';

    if (!buildOptions.disableSuperuser)
        args.push('--allow-superuser');

    args.push('build');

    var output_bin_path = binary_path;

    if (buildOptions.buildLocation)
        output_bin_path = buildOptions.buildLocation; 

    var build_file_name = path.basename(output_bin_path) + '.tar.gz';
    var build_output = path.join(output_bin_path, build_file_name);
    args.push(output_bin_path);

    if (fs.existsSync(build_output))
        fs.unlinkSync(build_output); 

    args.push('--architecture');
    args.push('os.linux.x86_64');

    if (buildOptions.mobileSettings) {
        args.push('--mobile-settings');
        args.push(JSON.stringify(buildOptions.mobileSettings));
    }

    if (buildOptions.serverOnly) {
        args.push('--server-only');
    } else if (!buildOptions.mobileSettings) {
        args.push('--mobile-settings');
        args.push(path.join(binary_path, 'settings.json'));
    }

    if (buildOptions.server) {
        args.push('--server');
        args.push(buildOptions.server);
    }

    if (buildOptions.allowIncompatibleUpdate) {
        args.push('--allow-incompatible-update');
    }

    var isWin = /^win/.test(process.platform);
    if (isWin) {
        // Sometimes cmd.exe not available in the path
        // See: http://goo.gl/ADmzoD
        executable = process.env.comspec || 'cmd.exe';
        args = ['/c', 'meteor'].concat(args);
    }

    var env = process.env; 
    env['METEOR_HEADLESS'] = 1; 
    var options = {
        cwd: binary_path,
        env: env,
        stdio: 'inherit'
    }; 

    cli.writeline('Build command: ' + executable + ' ' + args.join(" "));

    var meteor = spawn(executable, args, options);

    meteor.on('error', e => {
        cli.writeerror(options);
        cli.writeerror(e);
        cli.writeerror('This error usually happens when meteor is not installed.');
    });
    meteor.on('close', function () {

        if (!fs.existsSync(build_output)) {
            cli.writeerror('Cannot find the build ouput of your meteor application: ' + cli.writevariable(build_file_name) + ' in the build location: ' + output_bin_path); 
            return; 
        }

        cb(build_output); 
    });
}

function Package(binary_path, environment, application_name, meteor_settings_file, start_script) {
    cli.writeline('Using application directory ' + cli.writevariable(binary_path));

    if (!fs.existsSync(binary_path)) {
        cli.writeerror('The specified directoy (' + binary_path + ') to be deployed does not exist');
        process.exit(1);
    }

    var build_pack = 'node';

    if (meteor_settings_file != null) {
        var meteor_obj = resolveJsonFile(binary_path, meteor_settings_file); 
        if (meteor_obj == null)
            return;

        if (!environment.env)
            environment.env = {}; 

        environment.env["METEOR_SETTINGS"] = JSON.stringify(meteor_obj);
        build_pack = 'meteor';
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

        build_pack = 'remote-detect'; // the application has already been buold..
        environment['buildpack'] = build_pack;

        deploy(binary_path, application_name, environment, false);
        return;
    }

    var meteor_release = path.join(binary_path, OC_DETECT_METEOR);
    if (fs.existsSync(meteor_release)) {
        cli.writeline('Meteor.js framework detected');
        build_pack = 'meteor';
        if (!environment.meteorbuild)
            environment.meteorbuild = {};

        MeteorBuild(binary_path, application_name, environment, function (bin_path) {

            build_pack = 'meteor';
            environment['buildpack'] = build_pack;

            deploy(bin_path, application_name, environment, true);

        });

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

    environment['buildpack'] = build_pack;

    var ignore_file = path.join(binary_path, OC_IGNORE),
        ignore_set = {
            '.git': 1,
            '.ocignore': 1,
            'node_modules': 1
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

        deploy(bundle_path, application_name, environment, true);
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

    var cdir = process.cwd(), binary_path = cdir, application_name = null, app_id = null, environment_file = null, reset_tracking = false,
    meteor_settings_file = null,
    cmd = null;

    if (args && args.length > 0) {
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
                case '--cmd':
                    cmd = cli.nextArg(args, i);
                    break;
                case '-msf':
                    meteor_settings_file = cli.nextArg(args, i);
                    break;
                default:
                    cli.errors.unknownSwitch(args[i], 'deploy');
                    return;
            }
        }
    }

    var environment = {};

    if (environment_file == null) {
        var auto_detect_manifest = path.join(binary_path, OC_MANIFEST);
        cli.writeline('Find manifest file at ' + auto_detect_manifest); 
        if (fs.existsSync(auto_detect_manifest)) {
            environment_file = auto_detect_manifest;
            cli.writeline('Detected ' + cli.writevariable(OC_MANIFEST) + ' in application root directory'); 
            if ((environment = resolveJsonFile(binary_path, environment_file)) == null)
                return;
        }
    }
    else {
        if ((environment = resolveJsonFile(binary_path, environment_file)) == null)
            return;
    }

    if (application_name == null && app_id == null) {
        if (environment.name)
            application_name = environment.name;
        else
            application_name = path.basename(binary_path);
        
        cli.writeline('Using application name: ' + cli.writevariable(application_name)); 
    }

    remote.resolveAppId(application_name, app_id, 'deploy', function (id) {
        cli.debug('Deploy to application with id ' + cli.writevariable(id));

        Package(binary_path, environment, id, meteor_settings_file, cmd);
    });
}

module.exports = HandleRequest;