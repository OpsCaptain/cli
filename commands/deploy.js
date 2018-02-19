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
    OC_MANIFEST = fsfuncs.constants.OC_MANIFEST, 
    WIN_32 = /^win/.test(process.platform);


function recursivelyAddToArchive(base_dir, p_array, tracker, is_base_dir, ignore_set) {

    var key_prefix = p_array.join('/');
    var files = fs.readdirSync(base_dir); 
    
    for (var i = 0, ii = p_array.length; i < files.length; i++) {
        if (files[i] == OC_BUNDLE_FILENAME) continue;

        if (is_base_dir && ignore_set && ignore_set.hasOwnProperty(files[i]))
            continue;

        var fs_asset = path.join(base_dir, files[i]);

        if (fs.lstatSync(fs_asset).isSymbolicLink()) {
            fs_asset = fs.realpathSync(fs_asset);
        }

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
        buildpacks: oc_env.buildpacks
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

function hasAssetEndingWith(bin_path, asset) {
    var files = fs.readdirSync(bin_path);
    asset = asset.substring(1);
    for (var i = 0; i < files.length; i++) {
        if (files[i].endsWith(asset)) {
            cli.debug('Match: [' + files[i] + '] endsWith: [' + asset + ']'); 
            return true;
        }
    }
    return false;
}

function DetectApplicationType(bin_path) {
    // only detect and use one buildpack for now..
    var lang_assets = {
        PHP: ['index.php', 'composer.json'],
        Elixir: ['mix.exs'],
        Ruby: ['Gemfile'],
        Go: ['glide.yaml', 'Gopkg.toml', 'Gopkg.lock', 'Godeps/Godeps.json', 'vendor/vendor.json', 'src|*.go', 'vendor|*.go'],
        Dotnet: ['*.runtimeconfig.json', '*.csproj', '*.fsproj', '*.fsproj'],
        Python: ['requirements.txt', 'setup.py', 'environment.yml', 'Pipfile'],
        Meteor: ['.meteor/release'], 
        Nodejs: ['package.json'],
        Static: ['Staticfile']
    };

    for (var s in lang_assets) {
        var set = lang_assets[s];
        var i = 0;
        for (; i < set.length; i++) {
            var val = set[i];
            if (val.charAt(0) == '*') {
                if (hasAssetEndingWith(bin_path, val))
                    return [s];
            }
            else if (val.indexOf('|') > -1) {
                var _path = val.split('|'), langr = bin_path;
                var x = 0, len = _path.length - 1;

                for (; x < len; x++)
                    langr = path.join(langr, _path[x]);

                if (fs.existsSync(langr)) {
                    if (_path[x].charAt('*')) {
                        if (hasAssetEndingWith(langr, _path[x]))
                            return [s];
                    }
                    else {
                        langr = path.join(langr, _path[x]);
                        if (fs.existsSync(langr))
                            return [s];
                    }
                }
            }
            else {
                var langr = path.join(bin_path, val);
                if (fs.existsSync(langr)) {
                    return [s];
                }
            }
        }
    }
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

    if (WIN_32) {
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

function Package(binary_path, environment, application_name, start_script) {
    cli.writeline('Using application directory ' + cli.writevariable(binary_path));

    if (!fs.existsSync(binary_path)) {
        cli.writeerror('The specified directoy (' + binary_path + ') to be deployed does not exist');
        process.exit(1);
    }


    var is_java_type = false; 

    if (!fs.lstatSync(binary_path).isDirectory()) {
        if (!(binary_path.endsWith(".zip")
            || binary_path.endsWith(".tgz")
            || binary_path.endsWith(".tar.gz")
            || (is_java_type = binary_path.endsWith(".jar"))
            || (is_java_type = binary_path.endsWith(".war")))) {
            cli.writeerror('Acceptable file formats to deploy include: [.zip], [.tgz], [.tar.gz], [.jar] and [.war]');
            return;
        }

        if (!environment.buildpacks || environment.buildpacks.length == 0) {
            if (!is_java_type) {
                cli.writeerror('Expecting the buildpacks attribute in the ocmanifest.json file when deploying an archived build');
                cli.writeline('Acceptable buildpacks')
                return;
            }
            else {
                environment.buildpacks = ['java']; 
            }
        }

        deploy(binary_path, application_name, environment, false);
        return;
    }

    if (!(environment.buildpacks && environment.buildpacks.length > 0)) {
        environment.buildpacks = DetectApplicationType(binary_path);
        if (!(environment.buildpacks && environment.buildpacks.length > 0)) {
            cli.writeerror('Failed resolving the buildpacks to be used to build this application. You can specify the buildpacks for your application in the ocmanifest.json file');
            cli.writeerror('https://www.opscaptain.com/docs/ocmanifest')
            return; 
        }
        cli.writeline(environment.buildpacks[0] + ' project detected');
        environment.buildpacks[0] = environment.buildpacks[0].toLocaleLowerCase()
    }

    if (environment.buildpacks[0] == 'meteor') {
        if (!environment.meteorbuild)
            environment.meteorbuild = {};

        if (environment.meteorsettings) {
            var obj = resolveJsonFile(binary_path, environment.meteorsettings);
            if (obj == null) return;

            environment.env['METEOR_SETTINGS'] = JSON.stringify(obj);
        }

        MeteorBuild(binary_path, application_name, environment, function (bin_path) {
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

    var ignore_file = path.join(binary_path, OC_IGNORE),
        ignore_set = {
            '.git': 1,
            '.ocignore': 1,
            'node_modules': 1,
            '__ocbundle__.zip': 1
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
        deploy(bundle_path, application_name, environment, true);
    });


    output.on('end', function () {});


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

    for (var s in changes) {
        try 
        {
            archive.append(fs.createReadStream(changes[s].path), { name: s });
        }
        catch (e) {
            cli.writeerror('Cannot add resource to archive - Error: ' + e);
            cli.writeerror(changes[s].path);
            return;
        }
    }

    if (remote_delete.length > 0)
        archive.append(JSON.stringify(remote_delete), { name: OC_REMOTE_DELETIONS_FILENAME });

    archive.finalize();
}

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return; 

    var cdir = process.cwd(), binary_path = cdir, bin_path = null, application_name = null, app_id = null, environment_file = null, reset_tracking = false, 
    cmd = null, use_bp = null, cli_env_vars = {}, var_dc = null, rups = 0, ruas = 0;

    if (args && args.length > 0) {
        for (var i = 0, v; i < args.length; i += 2) {
            switch (args[i]) {
                case '-p':
                    bin_path = cli.nextArg(args, i).trim();
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
                case '-ev':
                    {
                        var_dc = cli.nextArg(args, i);
                        var x = var_dc.indexOf('=');
                        if (x == -1) {
                            cli.writeline('Invalid environment variable declaration: [' + var_dc + ']'); 
                            return; 
                        }
                        cli_env_vars[var_dc.substring(0, x)] = var_dc.substring(++x); 
                    }
                    break; 
                case '-bp':
                    use_bp = cli.nextArg(args, i); 
                    break;
                case '--rups':
                    rups = 1; 
                    break;
                case '--ruas':
                    ruas = cli.nextIntArg(args, i);
                    break; 
                case '--rs':
                    reset_tracking = true;
                    break;
                case '--cmd':
                    cmd = cli.nextArg(args, i);
                    break;
                default:
                    cli.errors.unknownSwitch(args[i], 'deploy');
                    return;
            }
        }
    }

    if (bin_path != null) {
        if (!((bin_path.length > 1 && bin_path.charAt(0) == '/') || (bin_path.length > 2 && bin_path[1] == ':'))) {
            bin_path = path.join(binary_path, bin_path); 
        }
    }
    else {
        bin_path = binary_path;
    }


    var environment = {};

    if (environment_file == null) {
        var auto_detect_manifest = path.join(binary_path, OC_MANIFEST);
        cli.writeline('Find manifest file in current working directory: ' + auto_detect_manifest); 
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

    if (!environment.env)
        environment.env = {};

    for (var s in cli_env_vars) {
        environment.env[s] = cli_env_vars[s]; 
    }

    if (rups)
        environment.rollupdatepingsuccess = 1;
    else if (ruas)
        environment.rollupdateaftersecs = ruas;


    if (use_bp) 
        environment.buildpacks = use_bp.split(','); 

    if (application_name == null && app_id == null) {
        if (environment.name)
            application_name = environment.name;
        else
            application_name = path.basename(binary_path);
        
        cli.writeline('Using application name: ' + cli.writevariable(application_name)); 
    }

    remote.resolveAppId(application_name, app_id, 'deploy', function (id) {
        cli.debug('Deploy to application with id ' + cli.writevariable(id));

        Package(bin_path, environment, id, cmd);
    });
}

module.exports = HandleRequest;