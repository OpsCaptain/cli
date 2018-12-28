var fs = require('fs'),
    path = require('path'), 
    cli = require('./occ');

function GetJsonObject(fn) {
    if (fs.existsSync(fn)) {
        var filec = fs.readFileSync(fn, { encoding: 'utf8' });
        try {
            return eval(['(', filec, ')'].join(""));;
        }
        catch (e) {
            cli.writeerror('Failed parsing json object from file with error: ' + e.toString());
        }
    }

    return null;
}

var funcs = {
    ObjectFromFile: GetJsonObject,
    constants: {
        OC_MANIFEST: 'ocmanifest.json',
        OC_IGNORE: '.ocignore'
    },
    resolveAppName: function (binary_path) {
        var auto_detect_manifest = path.join(binary_path, funcs.constants.OC_MANIFEST);

        if (fs.existsSync(auto_detect_manifest)) {
            environment_file = auto_detect_manifest;
            
            var obj = GetJsonObject(environment_file);
            if (obj == null)
                return;

            if (obj.name) return obj.name; 
        }

        var name = path.basename(binary_path);
        cli.writeline('Using application name: ' + cli.writevariable(name))
        return name; 
    }
}

module.exports = funcs;