var cli = require('../occ'),
    request = require('request'),
    remote = require('../remotecommon'),
    fsfuncs = require('../fsfuncs'),
    path = require('path'),
    fs = require('fs'), 
    endpoints = require('../endpoints');

function writeCell(e, padding) {
    if (e.length > padding) {
        return e.substring(0, e);
    }

    if (e.length < padding) {
        var num_spaces = padding - e.length; 
        var set = new Array(num_spaces);
        for (var i = 0; i < num_spaces; i++)
            set[i] = ' ';

        return e + set.join(""); 
    }
        
}

function HandleRequest(args) {
    if (!cli.isAuthenticated())
        return;

    var application_name = null;

    if (args && args.length > 0) {
        for (var i = 0, v; i < args.length; i += 2) {
            switch (args[i]) {
                case '-n':
                    application_name = cli.nextArg(args, i);
                    break;
                default:
                    cli.errors.unknownSwitch(args[i], 'status');
                    return;
            }
        }
    }

    if (application_name == null) {
        application_name = fsfuncs.resolveAppName(process.cwd());

        if (application_name == null || application_name == "") {
            cli.errors.expectsName('status');
            return;
        }
    }

    var query_str = {
        name : application_name
    };

    request({
        url: endpoints.appstatus,
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

        var set = JSON.parse(body);
        if (set.length == 0) {
            cli.writeerror('Status for application ' + cli.writevariable(application_name) + ' returned an empty result');
            return; 
        }

        console.log(''); 

        var obj = set[0];
        set = obj.instances;
        var dimensions = [15, 25, 30, 10];
        var headers = []
        headers.push(writeCell('NAME', dimensions[0]));
        headers.push(writeCell('STATUS', dimensions[1]));
        headers.push(writeCell('% MEM', dimensions[2]));
        headers.push(writeCell('% CPU', dimensions[3]));
        
        var row_width = dimensions[0]; 
        for (var i = 1; i < dimensions.length; i++)
            row_width += dimensions[i];
        /*
        var lborder = new Array(row_width); 
        for (var i = 0; i < row_width; i++)
            lborder[i] = '_';

        var border = lborder.join(""); 
      **/
        console.log(cli.colors.BRIGHT_MAGENTA + headers.join("") + cli.colors.RESET);

        for (var i = 0; i < set.length; i++) {
            var row = [];
            var inst = set[i];
           
            if (inst.status.startsWith('Up')) {
                row.push(cli.colors.BRIGHT_GREEN);
            }
            else {
                row.push(cli.colors.BRIGHT_RED);
            }
            
            row.push(writeCell(inst.name, dimensions[0]));
            row.push(writeCell(inst.status, dimensions[1]));
            row.push(writeCell(inst.memoryUsage, dimensions[2]));
            row.push(writeCell(inst.cpuUsage, dimensions[3]));

            row.push(cli.colors.RESET);
            console.log(row.join(""));
           // console.log(border);
        }
    }); 
}

module.exports = HandleRequest;