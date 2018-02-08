var fs = require('fs'),
    path = require('path'),
    occ = require('./occ'), 
    commands = require('./commands'),
    home_dir = require('os').homedir(),
    authfile = path.join(home_dir, 'ocauth.json');

global.__OC_DIR = home_dir; 
global.__OC_CLI = 'OpsCaptain CLI (v1.0.7)';

if (fs.existsSync(authfile)) {
    occ.debug('Authentication file [' + authfile + '] exists');

    var filec = fs.readFileSync(authfile, { encoding: 'utf8' });
    occ.debug(filec); 
    var apiKey = null;
    try {
        var obj = JSON.parse(filec);
        apiKey = obj.apikey;

        if (apiKey) {
            global.__OC_API_TOKEN = apiKey;
            occ.debug('Using apikey: ' + apiKey); 
        }
        else {
            occ.debug('apikey attribute does not exist in auth.json file - Possibly amended by another process');
        }
    }
    catch (e) {
        occ.debug('Failed to retrieve apikey from auth.json file with error: ' + e);
    }
}


occ.blueFont(global.__OC_CLI);

process.argv.splice(0, 2);

if (process.argv.length > 0) {
    var c = process.argv[0].toLocaleLowerCase(), handler = commands[c];
    if (handler) {
        process.argv.splice(0, 1); 
        handler(process.argv); 
    }
    else {
        occ.writeerror('Unrecognized command [' + c + ']'); 
    }
}
else {
    occ.writeerror('Must specify a command to exeute - Use [oc help] for more details');
}


