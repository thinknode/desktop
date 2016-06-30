module.exports = function(grunt) {
    /**
     * @summary Creates the Windows executable
     * @description
     * This task is responsible for building the windows executable and signing it.
     */
    grunt.registerTask('create-windows-exe', 'Builds the windows exe.', function() {
        var done = this.async();
        var createInstaller = require('electron-packager');
        var opts = {
            dir: './artifacts/build/',
            name: 'Thinknode',
            platform: 'win32',
            arch: 'ia32',
            version: '0.35.4',
            out: './artifacts/',
            asar: true,
            overwrite: true,
            icon: './assets/win/icon.ico',
            "version-string": {
              "ProductName": "Thinknode",
              "InternalName ": "Thinknode"
            }
        };
        return createInstaller(opts, function(err) {
            if (err) {
                done(err);
                throw new Error(err);
            }
            opts.arch = 'x64';
            return createInstaller(opts, function(err) {
                if (err) {
                    done(err);
                    throw new Error(err);
                }
                done();
            });
        });
    });
};
