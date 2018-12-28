var endpoints = require('../endpoints'),
    request = require('request'),
    cli = require('../occ'),
    fs = require('fs'),
    path = require('path'),
    _NAME = 'login', 
    readline = require('readline');

function auth(auth_json) {
    request({
        method: 'POST',
        url: endpoints.login,
        body: auth_json,
        headers: {
            'User-Agent': global.__OC_CLI
        }
    }, function (err, res, body) {
        if (err) {
            cli.writeerror('Login fail with error: ' + err);
            process.exit(1); 
        }

        try {
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

function HandleRequest(args) {

    var email, password, access_key;

    if (!args || !args.length) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Enter your email address or access key: ', (answer) => {
            email = answer;

            if (cli.String.nullorempty(email)) {
                cli.errors.expectsParameter('email or access key', _NAME);
                return;
            }
            
            if (cli.String.isEmail(email)) {
                rl.question('Enter your password: ', (answer) => {
                    password = answer;
                    
                    if (cli.String.nullorempty(password)) {
                        cli.errors.expectsParameter('password', _NAME);
                        return;
                    }

                    auth(JSON.stringify({ email: email, password: password }));
                });
            }
            else {
                auth(JSON.stringify({ apikey: email }));
            }
        });
    }
    else {
        for (var i = 0, v; i < args.length; i += 2) {
            switch (args[i]) {
                case '-em':
                    email = cli.nextArg(args, i);
                    break;
                case '-pw':
                    password = cli.nextArg(args, i);
                    break;
                case '-k':
                    access_key = cli.nextArg(args, i);
                    break; 
                default:
                    cli.errors.unknownSwitch(args[i], _NAME);
                    return;
            }
        }

        if (!cli.String.nullorempty(access_key)) {
            if (!cli.String.nullorempty(email)
                || !cli.String.nullorempty(password)) {
                cli.writeerror('On usage of thy [access key], ye shalt not entereth thy email or password');
                return;
            }

            auth(JSON.stringify({ apikey: access_key }));
        }
        else {
            if (cli.String.nullorempty(email) || email === undefined) {
                cli.errors.expectsParameter('-em', _NAME);
                return;
            }

            if (cli.String.nullorempty(password) || password == undefined) {
                cli.errors.expectsParameter('-pw', _NAME);
                return;
            }

            auth(JSON.stringify({ email: email, password: password }));
        }
    }
}

module.exports = HandleRequest;
