module.exports = function(grunt) {

    /**
     * @summary Creates a package directory for Linux
     * @description
     * This task is responsible for creating the Thinknode.app directory for Linux
     */
    grunt.registerTask('create-linux-package', 'Builds the Linux electron.app package.', function() {
        var done = this.async();
        var packager = require('electron-packager');
        return packager({
            dir: './artifacts/build/',
            name: 'Thinknode',
            platform: 'linux',
            arch: 'x64',
            version: '0.35.4',
            icon: "assets/linux/icon.png",
            "icon-size": 128,
            asar: true,
            overwrite: true,
            out: './artifacts/'
        }, function(err) {
            if (err) {
                throw new Error(err);
            }
            done();
        });
    });
};
