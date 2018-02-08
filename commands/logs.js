var cli = require('../occ'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'), 
    remote = require('../remotecommon'), 
    endpoints = require('../endpoints'); 


function LogEntry(obj, set_label) {
    this.ts = obj.time;
    this.time = obj.time;
    this.text = obj.log;
    this.label = set_label;
    this.stream = obj.stream;
    this.is_error = this.stream == "stderr";

    this.formatdate = function () {
        this.ts = this.ts.replace('T', ' ');
        this.ts = this.ts.replace("Z", "");
        var i = this.ts.lastIndexOf('.');
        if (i == -1)
            return;

        this.ts = this.ts.substring(0, i);
    }

    this.formatdate();

    this.ShouldAggregate = function (o) {
        return this.ts == o.ts
        && this.stream == o.stream
        && this.label == o.label;
    }

    this.PrintLine = function(prefix) {
        if (this.text.charAt(this.text.length - 1) == '\n')
            cli.cout(prefix + this.text);
        else
            console.log(prefix + this.text); 
    }

    this.PrintError = function (prefix) {
        if (this.text.charAt(this.text.length - 1) == '\n')
            cli.cout(cli.colors.BRIGHT_RED + prefix + this.text + cli.colors.RESET);
        else
            console.log(cli.colors.BRIGHT_RED + prefix + this.text + cli.colors.RESET);
    }
}

function Print(p_set) {
    console.log(cli.colors.BRIGHT_YELLOW + p_set[0].ts + ' -- ' + p_set[0].label + cli.colors.RESET);
    var prefix = '    ';

    if (p_set[o].is_error) {
        p_set[0].PrintError(prefix);

        for (var i = 1; i < p_set.length; i++)
            p_set[i].PrintError(prefix);
    }
    else {
        p_set[0].PrintLine(prefix);

        for (var i = 1; i < p_set.length; i++)
            p_set[i].PrintLine(prefix);
    }

    console.log(''); 
}

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return;

    if (!args || !args.length) {
        cli.missingArgs();
        return;
    }

    var application_name = null,  app_id = null, print_num = 100, is_db_logs = false;
    for (var i = 0, v; i < args.length; i += 2) {
        switch (args[i]) {
            case '-n':
                application_name = cli.nextArg(args, i);
                break;
            case '-i':
                app_id = cli.nextArg(args, i); 
                break;
            case '--tail':
                print_num = cli.nextIntArg(args, i); 
                break;
            case '--db':
                is_db_logs = true;
                break; 
            default:
                cli.errors.unknownSwitch(args[i], 'logs');
                return; 
        }
    }

    remote.resolveAppId(application_name, app_id, 'logs', function (id) {

        var query_str = {
            appid : id
        };

        var _url = is_db_logs ? endpoints.dblogs : endpoints.logs;

        request({
            url: _url,
            qs: query_str,
            method: 'GET',
            headers: remote.getRequestHeaders()
        }, function (err, res, body) {
            if (res.statusCode != 200) {
                if (!err)
                    err = cli.errDef.remoteNon200(res.statusCode);
            }

            if (err || !body) {
                cli.writeerror(err);
                return;
            }

            cli.debug(body);

            var obj = JSON.parse(body);
            
            var log_entries = [];
            for (var s in obj) {
                var l_set = obj[s];

                for (var i = 0; i < l_set.length; i++) {
                    log_entries.push(new LogEntry(l_set[i], s));
                }
            }

            console.log(''); 

            if (log_entries.length == 0) {
                console.log('Quiet as a mouse!');
                console.log(''); 
                return; 
            }

            log_entries.sort(function (a, b) {
                if (a.ts == b.ts) {
                    if (a.label == b.label) return 0;
                    else if (a.label < b.label) return -1;
                    else return 1;
                }
                else if (a.ts < b.ts) return -1;
                else return 1;
            });


            for (var i = 0; i < log_entries.length && print_num > 0;) {
                var log = log_entries[i], p_set = [log];

                for (++i, --print_num; print_num > 0 && i < log_entries.length; i++, --print_num) {
                    if (log_entries[i].ShouldAggregate(log)) {
                        p_set.push(log_entries[i]);
                    }
                    else {
                        break;
                    }
                }

                Print(p_set);
            }

            console.log(''); 

        });

    }); 
}

module.exports = HandleRequest; 