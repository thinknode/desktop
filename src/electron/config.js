var fs = require('fs-extra');

/**
 * Handles reading and updating the electron configuration from the users home folder
 * @param {Electron.app} app
 */
function Config(app) {
    this.app = app;
    this.savePath = this.app.getPath('home') + '/.thinknode/thinknode/';
    this.filename = 'config.json';
    this.getConfig = function() {
        // Cannot rely on config.json existing
        try {
            // On linux this throws an exception if .thinknode does not exist.
            if (!fs.existsSync(this.savePath + this.filename)) {
                fs.ensureDirSync(this.savePath);
                return {};
            }
        } catch(e) {
            fs.ensureDirSync(this.savePath);
            return {};
        }
        var buf = fs.readFileSync(this.savePath + this.filename);
        if (buf.length === 0) {
            return {};
        } else {
            return JSON.parse(buf);
        }
    };

    this.setConfig = function(property, value) {
        var config = this.getConfig();
        config[property] = value;
        fs.writeFileSync(this.savePath + this.filename, JSON.stringify(config));
    };
}

module.exports = Config;
