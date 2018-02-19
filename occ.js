
var colors = {
    BRIGHT_YELLOW: "\u001b[33;1m", 
    RESET: "\u001b[0m", 
    RED: "\u001b[31m",
    BRIGHT_RED: "\u001b[31;1m", 
    GREEN: "\u001b[32m", 
    BRIGHT_GREEN: "\u001b[32;1m", 
    BRIGHT_BLUE: "\u001b[34;1m",
    BRIGHT_BLACK: "\u001b[30;1m",
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
            writeerror('The [' + command + '] command expects the [-n] parameter which is used to specify the name of the app')
        },
        expectsParameter : function(p, cmd){
            writeerror('The ' + writevariable(cmd) + ' command expects the ' + writevariable(p) + ' parameter'); 
        }, 
        unknownSwitch : function(s, cmd){
            writeerror('Unknown parameter ' + writevariable(s) + ' specified for command: ' + writevariable(cmd)); 
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
    }
}; 