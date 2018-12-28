var spawn = require('child_process').spawn;

var colors = {
    BRIGHT_YELLOW: "\u001b[33;1m", 
    RESET: "\u001b[0m", 
    RED: "\u001b[31m",
    BRIGHT_RED: "\u001b[31;1m", 
    GREEN: "\u001b[32m", 
    BRIGHT_GREEN: "\u001b[32;1m", 
    BRIGHT_BLUE: "\u001b[34;1m",
    BRIGHT_BLACK: "\u001b[30;1m",
    BRIGHT_MAGENTA: "\u001b[35;1m",
    BLACK : "\u001b[30m",
    BLUE: "\u001b[34", 
    BRIGHT_CYAN: "\u001b[36;1m", 
    CYAN: "\u001b[36"
}


function writeerror(e) {
    console.error(colors.BRIGHT_RED + '(!) Error: ' + e + colors.RESET); 
}

function errorline(e) {
    console.error(colors.BRIGHT_RED + e + colors.RESET);
}

function writevariable(e) {
    return  '[' + e + ']'; 
}

function writeline(e) {
    console.log(colors.BRIGHT_YELLOW + 'CLI: ' + colors.RESET + e)
}

function cout(e) {
    process.stdout.write(e); 
}

function switchExpectsValue(args, i) {
    writeerror('Expecting a value for the switch [' + args[i] + ']');
}

if (!"".hasOwnProperty("endsWith")) {
    String.prototype.endsWith = function (value) {
        var i = this.indexOf(value);
        return i > -1 && i == this.length - value.length;
    };
}

if (!"".hasOwnProperty("startsWith")) {
    String.prototype.startsWith = function (value) {
        return this.indexOf(value) == 0;
    };
}

if (!"".hasOwnProperty("trim")) {
    String.prototype.trim = function (value) {
        return this.replace(/^\s+|\s+$/g, "");
    }
}


module.exports = {
    writeerror : writeerror,
    writeline : writeline,
    writevariable: writevariable,
    errorline: errorline,
    cout: cout,
    colors: colors,
    checkIsLatest: function (cur_version, cb) {
        var ld = require('./Spinner')('Checking CLI latest version from npm...    ');
        ld.start();

        var WIN_32 = /^win/.test(process.platform);
        var proc_handle = null;
        if (WIN_32) {
            proc_handle = spawn('cmd.exe', ['/c', 'npm', 'show', 'opscaptain-cli', 'version'])
        }
        else {
            proc_handle = spawn('npm', ['show', 'opscaptain-cli', 'version']);
        }

        var had_data = 0, all_str = '';

        proc_handle.stdout.on('data', function (data) {
            var str = data.toString();
            all_str += str;
        });

        proc_handle.stderr.on('data', function (data) {
            had_data = 1;
        })

        proc_handle.on('close', function (data) {
            all_str = all_str.trim();
            ld.stop();

            if (all_str != cur_version) {
                writeline('A new version of the CLI is currently available: [v' + all_str + ']'); 
                writeline('Update to the latest using the below command:');
                writeline('\u001b[32;1mnpm install -g opscaptain-cli\u001b[0m');
                console.log('');
            }
            else {
                writeline('You are currently running the latest version of the OpsCaptain CLI: [v' + cur_version + ']');
                console.log('');
            }

            cb();
        });
    },
    blueFont :  function(e){
        console.log(colors.BRIGHT_CYAN + e + colors.RESET); 
    }, 
    errDef : {
        remoteNon200: function (status) {
            return 'Remote request returned an error response code (' + status.toString() + ')';
        }
    }, 
    errors : {
        expectsName: function (command) {
            writeerror('The [' + command + '] command expects the [-n] parameter which is used to specify the name of the app');
            process.exit(1);
        },
        expectsParameter : function(p, cmd){
            writeerror('The ' + writevariable(cmd) + ' command expects the ' + writevariable(p) + ' parameter');
            process.exit(1);
        }, 
        unknownSwitch : function(s, cmd){
            writeerror('Unknown parameter ' + writevariable(s) + ' specified for command: ' + writevariable(cmd));
            process.exit(1);
        }
    }, 
    randomId : function getId() {
        return new Date().getTime().toString() + '-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    isAuthenticated: function(){
        if (!global.hasOwnProperty('__OC_API_TOKEN')) {
            writeerror('Command requires authentication via the [login -em <email> -pw <password>] command to proceed')
            return false; 
        }

        return true; 
    },
    debug : function(e){
        if (process.env.DEBUG == '1' || process.env.VERBOSE == '1') {
            console.log('DEBUG: ' + e)
        }
    }, 
    missingArgs: function () {
        writeerror('Expecting one or more arguments to proceed')
    },
    nextIntArg : function(args, i){
        if (i + 1 < args.length) {
            var v = args[i + 1];

            try
            {
                return parseInt(v); 
            }
            catch (e) {
                writeerror('Failed parsing integer value for switch [' + args[i] + ']'); 
            }
        }
        else
            switchExpectsValue(args, i);

        process.exit(1);
    }, 
    nextArg: function (args, i) {
        if (i + 1 < args.length)
            return args[i + 1];
        else
            switchExpectsValue(args, i);

        process.exit(1); 
    },
    String: {
        nullorempty: function (value) {
            return null == value || "" == value; 
        },
        isEmail : function (the_value) {
            var chk = 0, at = 0, at_index = 0;

            for (var i = 0; i < the_value.length; i++) {
                if (the_value.charAt(i) == '@') {
                    ++at;
                    at_index = i;
                }
                else if (the_value.charAt(i) == '.')
                    chk = i;
            }

            if (!(at == 1 && chk > at_index)) return false; 

            return true;
        }
    }
}; 