var cli = require('../occ'); 

module.exports = function (args) {
    var str = [];
    str.push('\n')
    str.push('Usage:   opscaptain [COMMAND] [OPTIONS]');
    str.push('\n\n');
    str.push('Commands:\n');
    str.push('  deploy    Deploy a new build of your application\n');
    str.push('  status    Get the status and resource usage of your application\n');
    str.push('  logs      Tail the logs of your app and database containers\n');
    str.push('  restart   Restart either app or database containers\n');
    str.push('  stop      Stop all app containers\n');
    str.push('  login     Authenticate to retrieve the Api Key used by the CLI\n');
    str.push('\n')
    str.push('Options:\n');
    str.push('  -n        Specify the name of your application\n');
    str.push('  -i        Specify the app id of your application instead of name. Rarely used\n');
    str.push('  -p        Specify the path to your application folder or build output\n');
    str.push('  -e        Specify the path to the file containing your environment variables. Supports\n');
    str.push('            both relative and absolute paths\n');
    str.push('  -swait    On rolling updates, the number of seconds to wait before replacing containers\n');
    str.push('  --tail    Specify the number of lines of log entries to print\n');
    str.push('  --db      The specified command is to be executed for database containers instead of app containers\n');
    str.push('  -em       The email address to be used with the login command\n');
    str.push('  -pw       The password of your email account\n');
    console.log(str.join("")); 
}