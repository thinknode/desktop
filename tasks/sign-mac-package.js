module.exports = function(grunt) {

    /**
     * @summary Signs the Thinknode.app application
     * @description
     * This task is responsible for signing the electron application on Mac, does not export
     * a DMG.
     */
    grunt.registerTask('sign-mac-package', 'Signs the electron application.', function() {
        var done = this.async();
        var codesign = require('electron-installer-codesign');
        if (typeof grunt.option('identity') !== 'string') {
           var msg = "Missing identity parameter, please specify the SHA1";
            msg += " of the code signing identity with --identity \"<id>\" parameter";
            done(msg);
        }
        return codesign({
            appPath: './artifacts/Thinknode-darwin-x64/Thinknode.app/',
            identity: grunt.option('identity')
        }, function(err, filePaths) {
            if (err) {
                throw new Error(err);
            }
            done();
        });
    });
};