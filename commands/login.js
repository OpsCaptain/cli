var endpoints = require('../endpoints'),
    request = require('request'),
    cli = require('../occ'),
    fs = require('fs'),
    path = require('path'),
    _NAME = 'login';

function HandleRequest(args) {
    if (!args || !args.length) {
        cli.missingArgs();
        return;
    }

    var email, password;

    for (var i = 0, v; i < args.length; i += 2) {
        switch (args[i]) { 
            case '-em':
                email = cli.nextArg(args, i);
                break;
            case '-pw':
                password = cli.nextArg(args, i); 
                break;
            default:
                cli.errors.unknownSwitch(args[i], _NAME); 
                return; 
        }
    }

    if (email == null || email == "" || email === undefined) {
        cli.errors.expectsParameter('-e', _NAME); 
        return; 
    }

    if (password == null || password == "" || password == undefined) {
        cli.errors.expectsParameter('-p', _NAME); 
        return; 
    }

    request({
        method: 'POST',
        url: endpoints.login,
        body: JSON.stringify({ email: email, password: password }),
        headers: {
            'User-Agent': global.__OC_CLI
        },
    }, function (err, res, body) {
        if (err) {
            cli.writeerror('Login fail with error: ' + err);
            return; 
        }


        try 
        {
            var obj = JSON.parse(body);
            if (res.statusCode == 200) {
                var apikey = obj.apikey;
                var auth_file = path.join(global.__OC_DIR, 'ocauth.json');
                fs.writeFileSync(auth_file, body);
                cli.writeline('Ok');
            }
            else
                throw obj.err; 
        }
        catch (e) {
            cli.writeerror(e); 
        }
    }); 
}

module.exports = HandleRequest;
