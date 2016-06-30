module.exports = function(grunt) {
    grunt.registerTask('build', 'Signs the electron application.', function(type) {
        grunt.task.run('sass:dist', 'copy', 'preprocess', 'symlink');
        if (type === 'mac') {
            grunt.task.run('create-mac-package', 'sign-mac-package', 'create-mac-dmg');
        } else if (type === 'linux') {
            grunt.task.run('create-linux-package', 'electron-debian-installer', 'electron-redhat-installer');
        } else if (type === 'win') {
            grunt.task.run('create-windows-exe', 'create-windows-installer');
        }
    });
};
