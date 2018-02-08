var deployCommand = require('./deploy'),
    helpCommand = require('./help'),
    logsCommand = require('./logs'),
    restartCommand = require('./restart'),
    stopCommand = require('./stop'),
    loginCommand = require('./login'),
    statusCommand = require('./status'), 
    versionCommand = require('./version'); 


module.exports = {
    deploy: deployCommand,
    help: helpCommand,
    '-help': helpCommand,
    '--help': helpCommand,
    version: versionCommand,
    '-version': versionCommand,
    '--version': versionCommand,
    logs: logsCommand, 
    restart: restartCommand,
    stop: stopCommand,
    login: loginCommand,
    status: statusCommand
}; 