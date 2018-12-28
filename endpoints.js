
var _URL_BASE = 'https://api.opscaptain.com/api';
if (process.env.DEVELOP)
    _URL_BASE = 'http://localhost:8080/api'; 

module.exports = {
    deploy: _URL_BASE + '/instances/app/deploy',
    status: _URL_BASE + '/instances/app/deploystatus',
    appId: _URL_BASE + '/instances/app/getappid',
    login: _URL_BASE + '/users/getapikey',
    logs: _URL_BASE + '/instances/app/logsaggregate',
    dblogs: _URL_BASE + '/instances/db/logsaggregate',
    appstatus: _URL_BASE + '/instances',
    restartapp: _URL_BASE + '/instances/app/restart',
    restartdb: _URL_BASE + '/instances/db/restart',
    stopapp: _URL_BASE + '/instances/app/stop'
}; 