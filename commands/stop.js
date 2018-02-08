var cli = require('../occ'),
    request = require('request'),
    remote = require('../remotecommon'),
    endpoints = require('../endpoints');

var _CMD = 'stop';

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return;

    if (!args || !args.length) {
        cli.missingArgs();
        return;
    }

    var application_name = null, app_id = null;
    for (var i = 0, v; i < args.length; i += 2) {
        switch (args[i]) {
            case '-n':
                application_name = cli.nextArg(args, i);
                break;
            case '-i':
                app_id = cli.nextArg(args, i);
                break;
            default:
                cli.errors.unknownSwitch(args[i], _CMD);
                return;
        }
    }

    if (application_name == null) {
        cli.errors.expectsName(_CMD);
        return;
    }

    remote.ByAppId(endpoints.stopapp, application_name, app_id, _CMD, {}, 'PUT', function (data) {
        cli.writeline('App containers stopped successfully');
    });
}

module.exports = HandleRequest;