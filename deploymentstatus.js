var request = require('request'), 
    endpoints = require('./endpoints'),
    remote = require('./remotecommon'), 
    cli = require('./occ');

function DeploymentStatus(deployment_id, app_id, cb) {
    this.id = deployment_id;
    this.appid = app_id;
    this.queryStr = { appid: this.appid, id: this.id };

    cli.debug('Request query string: ' + JSON.stringify(this.queryStr));

    this.url = endpoints.status;
    this.error_count = 0;
    this.eof = false;
    this.callback = cb;
    var self = this;

    this.PrintStatus = function (obj) {
        if (obj.logs && obj.logs.length > 0) {
            for (var i = 0; i < obj.logs.length; i++) {
                if (obj.logs[i] == 'Done') {
                    this.eof = true;
                    console.log(''); 
                    cli.writeline('Deployment in orbit - Check for stability using the status and logs commands');
                    if (self.callback) self.callback(false); 
                    return; 
                }

                var log_entry = obj.logs[i];

                if (log_entry.charAt(log_entry.length - 1) == '\n')
                    cli.cout(log_entry);
                else
                    console.log(log_entry); 
            }
        }

        if (obj.err.length > 0) {
            var i = obj.err.indexOf('{');
            if (i > -1) {
                var err = obj.err.substring(i);

                try {
                    var node = JSON.parse(err);
                    err = node.err.split("\\n");
                    for (var i = 0; i < err.length; i++)
                        cli.errorline(err[i].replace(/\\/g, ''));
                }
                catch (e) {

                }
            }
            else {
                cli.writeerror(obj.err);
            }

            if (self.callback) self.callback(true);

            cli.writeerror(obj.err);
            process.exit(1);
            return;
        }

        cli.debug('Poll for deployment status after 2 seconds');

        setTimeout(function () {
            self.Dispatch(); 
        }, 2000); 
    }

    this.Dispatch = function () {
        request({
            url: this.url,
            qs: this.queryStr,
            method: 'GET',
            headers: remote.getRequestHeaders()
        }, function (err, res, body) {
            if (res.statusCode != 200) {
                if (!err)
                    err = cli.errDef.remoteNon200(res.statusCode); 
            }

            if (err || !body) {
                ++self.error_count;

                cli.debug('Deployment status error from remote: ' + err);

                if (self.error_count == 10) {
                    cli.writeerror(err); 
                    return; 
                }

                self.startPolling(); 
                return; 
            }

            self.error_count = 0; 
            
            //cli.debug('Remote response: ' + body);

            var obj = JSON.parse(body);
            self.PrintStatus(obj);
        });
    }

    this.startPolling = function () {

        cli.debug('Poll for deployment status after 3 seconds');

        setTimeout(function () {
            self.Dispatch(); 
        }, 3000); 
    }
}

module.exports = DeploymentStatus; 