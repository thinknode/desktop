module.exports = function(grunt) {

    /**
     * @summary Creates a package directory for Mac
     * @description
     * This task is responsible for creating the Thinknode.app directory
     */
    grunt.registerTask('create-mac-package', 'Builds the Mac electron.app package.', function() {
        var done = this.async();
        var packager = require('electron-packager');
        return packager({
            dir: './artifacts/build/',
            name: 'Thinknode',
            platform: 'darwin',
            arch: 'x64',
            version: '0.35.4',
            icon: "assets/osx/icon.icns",
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