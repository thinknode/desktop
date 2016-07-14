/*
 * Apps Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appsController($rootScope, session, $state, $scope) {

        // --------------------------------------------------
        // Required modules

        var bluebird = require('bluebird');
        var fs = bluebird.promisifyAll(require('fs'));
        var fspath = require('path');
        var remote = require('remote');
        var dialog = remote.require('dialog');


        // --------------------------------------------------
        // Scope variables

        $scope.apps = [];

        $scope.link = {
            "visible": false,
            "app": null
        };

        $scope.create = {
            "visible": false,
            "processing": false,
            "app": {}
        };

        // --------------------------------------------------
        // Scope methods

        /**
         * @summary Links an app to a local development location.
         *
         * @param {object} app - The app to link.
         */
        $scope.linkApp = function(app) {
            dialog.showOpenDialog(remote.getCurrentWindow(), {
                title: "Select directory to link app",
                properties: ['openDirectory', 'createDirectory']
            }, function(filenames) {
                if (typeof filenames === 'undefined' || filenames.length !== 1) {
                    return;
                }
                app.path = filenames[0];
                var filepath = fspath.resolve(app.path, 'manifest.json');
                return fs.readFileAsync(filepath).then(function(data) {
                    $scope.link.visible = true;
                    $scope.link.app = app;
                }).catch(function(err) {
                    if (err.code !== 'ENOENT') {
                        throw err;
                    }
                    return session.getBranch(app.name, "master", true).then(function(branch) {
                        app.commit = branch.commit;
                        return session.saveManifest(app.path, branch.manifest);
                    }).then(function() {
                        return session.registerApp(app);
                    });
                }).then(function() {
                    $scope.$apply();
                });
            });
        };

        /**
         * @summary Keeps the manifest that already exists.
         */
        $scope.linkAppKeep = function() {
            var app = $scope.link.app;
            session.getBranch(app.name, "master").then(function(branch) {
                app.commit = branch.commit;
                return session.registerApp(app);
            }).then(function() {
                $scope.link.visible = false;
                $scope.link.app = null;
            });
        };

        /**
         * @summary Overwrites the existing manifest with the contents of the manifest from the
         *   master branch.
         */
        $scope.linkAppOverwrite = function() {
            var app = $scope.link.app;
            session.getBranch(app.name, "master", true).then(function(branch) {
                app.commit = branch.commit;
                return session.saveManifest(app.path, branch.manifest);
            }).then(function() {
                return session.registerApp(app);
            }).then(function() {
                $scope.link.visible = false;
                $scope.link.app = null;
            });
        };

        /**
         * @summary Opens the dialog to create an app.
         */
        $scope.createApp = function() {
            $scope.create.visible = true;
        };

        /**
         * @summary Closes the dialog to create an app.
         */
        $scope.createAppCancel = function() {
            $scope.create.app = {};
            $scope.create.visible = false;
        };

        /**
         * @summary Creates a new app.
         */
        $scope.createAppSubmit = function() {
            session.createApp($scope.create.app).then(function(success) {
                if (success) {
                    $scope.create.app = {};
                    $scope.create.visible = false;
                    $scope.create.processing = false;
                }
            });
        };

        /**
         * @summary Opens an app for development.
         *
         * @param {object} app - The app to open.
         */
        $scope.openApp = function(app) {
            session.openApp(app);
            $state.go('devkit.app.details', {
                "app": app.name
            });
        };

        /**
         * @summary Repairs an app whose specified path is missing a manifest.
         *
         * @param {object} app - The app to repair.
         */
        $scope.repairApp = function(app) {
            dialog.showOpenDialog(remote.getCurrentWindow(), {
                title: "Select directory to repair link to app",
                properties: ['openDirectory', 'createDirectory']
            }, function(filenames) {
                if (typeof filenames === 'undefined' || filenames.length !== 1) {
                    return;
                }
                app.path = filenames[0];
                var filepath = fspath.resolve(app.path, 'manifest.json');
                return fs.readFileAsync(filepath).then(function(data) {
                    $scope.link.visible = true;
                    $scope.link.app = app;
                }).catch(function(err) {
                    if (err.code !== 'ENOENT') {
                        throw err;
                    }
                    return session.getBranch(app.name, "master", true).then(function(branch) {
                        app.commit = branch.commit;
                        return session.saveManifest(app.path, branch.manifest);
                    }).then(function() {
                        return session.registerApp(app);
                    });
                }).then(function() {
                    app.damaged = false;
                    $scope.$apply();
                });
            });
        };

        /**
         * @summary Unlinks an app from a local development location.
         *
         * @param {object} app - The app to unlink.
         */
        $scope.unlinkApp = function(app) {
            delete app.path;
            session.unregisterApp(app.name);
        };

        // --------------------------------------------------
        // Initialization
        
        function init() {
            $scope.apps = session.apps;
            $scope.$apply();
        }
        
        $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appsController', [
        '$rootScope',
        'session',
        '$state',
        '$scope',
        '$http',
        appsController
    ]);
})();