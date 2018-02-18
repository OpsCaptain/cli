var request = require('request'), 
    endpoints = require('./endpoints'), 
    cli = require('./occ');

var common = {
    stickyCookie : null,
    getSticky : function(res){
        for (var s in res.headers) {
            if (s == 'set-cookie') {
                var cookies = res.headers[s];
                for (var i = 0; i < cookies.length; i++) {
                    if (cookies[i].indexOf('route=') > -1) {
                        common.stickyCookie = cookies[i]; 
                    }
                }
            }
        }
    }, 
    getRequestHeaders: function () {
        var obj = {
            'User-Agent': global.__OC_CLI,
            'Authorization': 'Bearer ' + global.__OC_API_TOKEN
        };

        if (common.stickyCookie != null) {
            obj['Cookie'] = common.stickyCookie; 
        }

        cli.debug(JSON.stringify(obj)); 

        return obj; 
    },
    ByAppId: function (url, application_name, app_id, cmd, params, method, cb) {
        cli.debug('Request url: ' + url);
        common.resolveAppId(application_name, app_id, cmd, function (_id) {

            var query_str = {
                appid: _id
            };

            for (var s in params)
                query_str[s] = params[s]; 

            cli.debug('Request headers: ' + JSON.stringify(query_str));

            request({
                url: url,
                qs: query_str,
                method: method,
                headers: common.getRequestHeaders()
            }, function (err, res, body) {
                if (res.statusCode != 200) {
                    if (!err)
                        err = cli.errDef.remoteNon200(res.statusCode);
                }

                if (err || !body) {
                    cli.writeerror(err);
                    return;
                }

                common.getSticky(res); 
                cb(body); 
            });
        }); 
    }, 
    resolveAppId: function (application_name, app_id, cmd, cb) {
        if (application_name == null) {
            if (app_id == null) {
                cli.errors.expectsName(cmd);
                process.exit(1);
            }

            cb(app_id);
        }
        else {
            common.getAppId(application_name, function (_ids) {
                if (_ids.length > 1) {
                    cli.writeerror('Application with name ' + cli.writevariable(application_name) + ' has multiple associated instances');
                    cli.writeerror('Available Instances:');

                    for (var i = 0; i < _ids.length; i++) {
                        cli.writeerror(cli.writeerror(_ids[i]));
                    }

                    return;
                }
                
                cb(_ids[0]); 
            })
        }
    }, 
    getAppId: function (name, cb_s, cb_err) {
        if (!cb_s)
            return;

        var _h = common.getRequestHeaders();

        request.get({
            url: endpoints.appId,
            qs : {
                name : name
            }, 
            headers: _h
        }, function (err, res, body) {
            if (res.statusCode != 200) {
                if (!err)
                    err = 'Remote request returned an error response code (' + res.statusCode.toString() + ')';

            }

            if (err) {
                cli.writeerror(err);
                if (cb_err) {
                    cb_err();
                }
            }
            else if (body) {
                common.getSticky(res);
                cli.debug('Remote response: ' + body);
                var obj = JSON.parse(body);
                obj = obj['ids']; 
                cb_s(obj); 
            }
        }); 
    }
}

module.exports = common; 