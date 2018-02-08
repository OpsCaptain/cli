var fs = require('fs');

function GetJsonObject(fn) {
    if (fs.existsSync(fn)) {
        var filec = fs.readFileSync(fn, { encoding: 'utf8' });
        try {
            return JSON.parse(filec);
        }
        catch (e) {
            occ.writeerror('Unable to retrieve APIKey from stored auth.json file - Error: ' + e.toString());
        }
    }

    return null;
}

module.exports = {
    ObjectFromFile : GetJsonObject
}