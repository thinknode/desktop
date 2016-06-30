module.exports = function(grunt) {

    /**
     * @summary Creates a DMG from the Thinknode.app directory
     * @description
     * This task is responsible for exporting the signed Thinknode.app as a DMG installer.
     */
    grunt.registerTask('create-mac-dmg', 'Signs the electron application.', function() {
        var done = this.async();
        var createDMG = require('electron-installer-dmg');
        return createDMG({
            appPath: process.cwd() + '/artifacts/Thinknode-darwin-x64/Thinknode.app/',
            debug: true,
            overwrite: true,
            name: "Thinknode",
            icon: "./assets/osx/icon.icns",
            background: "./assets/osx/installer.png",
            out: process.cwd() + "/artifacts/"
        }, function(err) {
            if (err) {
                throw new Error(err);
            }
            done();
        });
    });
};