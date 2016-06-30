
module.exports = {
    copy: {
        files: [{
            src: 'src/**',
            dest: 'artifacts/build/'
        }, {
            src: ['bower/**/*.min.js'],
            dest: 'artifacts/build/'
        }, {
            src: ['bower/angular**/*.js'],
            dest: 'artifacts/build/'
        }, {
            src: ['bower/ng-notifications-bar/dist/*'],
            dest: 'artifacts/build/'
        }, {
            src: ['bower/angular-ui-router/**'],
            dest: 'artifacts/build/'
        }, {
            src: ['bower/ace-builds/src-min-noconflict/**'],
            dest: 'artifacts/build/'
        }, {
            src: ['bower/**/*.min.css'],
            dest: 'artifacts/build/'
        }, {
            src: 'assets/**',
            dest: 'artifacts/build/'
        }, {
            src: 'index.html',
            dest: 'artifacts/build/'
        }, {
            src: 'main.js',
            dest: 'artifacts/build/'
        }, {
            src: 'package.json',
            dest: 'artifacts/build/'
        }]
    }
};