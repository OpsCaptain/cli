var cli = require('../occ'),
    request = require('request'),
    fsfuncs = require('../fsfuncs'),
    remote = require('../remotecommon'),
    endpoints = require('../endpoints');

var _CMD = "restart";

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return;

    var application_name = null, is_db = false, app_id = null;

    if (args && args.length > 0) {
        for (var i = 0, v; i < args.length; i += 2) {
            switch (args[i]) {
                case '-n':
                    application_name = cli.nextArg(args, i);
                    break;
                case '-i':
                    app_id = cli.nextArg(args, i);
                    break;
                case '--db':
                    is_db = true;
                    break;
                default:
                    cli.errors.unknownSwitch(args[i], _CMD);
                    return;
            }
        }
    }

    if (application_name == null) {
        application_name = fsfuncs.resolveAppName(process.cwd());

        if (application_name == null || application_name == "") {
            cli.errors.expectsName(_CMD);
            return;
        }
    }

    remote.ByAppId(is_db ? endpoints.restartdb : endpoints.restartapp, application_name, app_id, _CMD, {}, 'PUT', function (data) {
        cli.writeline('Restart of containers is in progress');
        cli.writeline('Use the status command to verify restart is complete'); 
    }); 
}

module.exports = HandleRequest;