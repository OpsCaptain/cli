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
    str.push('  -bp       Specify the buildpack(s). Separate multiple values with a comma\n');
    str.push('  -ev       Specify an environment variable. Example -ev "NAME=VALUE" \n');
    str.push('  -i        Specify the app id of your application instead of name. Rarely used\n');
    str.push('  -p        Specify the path to your application folder or build output\n');
    str.push('  -e        Specify the path to the ocmanifest.json file. Supports\n');
    str.push('            both relative and absolute paths\n');
    str.push('  --ruas    On rolling updates, the number of seconds to wait before replacing containers\n');
    str.push('  --tail    Specify the number of lines of log entries to print\n');
    str.push('  --db      The specified command is to be executed for database containers instead of app containers\n');
    str.push('  -em       The email address to be used with the login command\n');
    str.push('  -pw       The password of your email account\n');
    str.push('\n')
    str.push('Buildpacks:\n');
    str.push('  nodejs    https://github.com/heroku/heroku-buildpack-nodejs\n');
    str.push('  meteor    https://www.opscaptain.com/docs/nodejs/meteorjs-hosting (For Meteor.js projects)\n');
    str.push('  ruby      https://github.com/cloudfoundry/ruby-buildpack\n');
    str.push('  dotnet    https://github.com/cloudfoundry/dotnet-core-buildpack/\n');
    str.push('  python    https://github.com/cloudfoundry/python-buildpack\n');
    str.push('  java      https://github.com/cloudfoundry/java-buildpack (All JVM languages supported)\n');
    str.push('  php       https://github.com/cloudfoundry/php-buildpack\n');
    str.push('  go        https://github.com/cloudfoundry/go-buildpack\n');
    str.push('  elixir    https://github.com/HashNuke/heroku-buildpack-elixir\n');
    str.push('  phoenix-static  https://github.com/gjaldon/heroku-buildpack-phoenix-static\n');
    str.push('  static    https://github.com/cloudfoundry/staticfile-buildpack (Deploy static websites)\n');
    str.push('\n')
    str.push('Examples:\n');
    str.push('  deploy    opscaptain deploy -n myapp -bp nodejs -ev "API_KEY=some-secret"\n');
    console.log(str.join("")); 
}