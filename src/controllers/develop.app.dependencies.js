/*
 * App Dependencies Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appDependenciesController($session, $state, $params, $scope, $manifest) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');
        var fspath = require('path');
        var remote = require('remote');
        var shell = remote.require('shell');

        // --------------------------------------------------
        // Local variables

        // --------------------------------------------------
        // Local functions

        // --------------------------------------------------
        // Scope variables

        // --------------------------------------------------
        // Scope methods

        $scope.editManifest = function() {
            shell.openItem(fspath.join($manifest.app.path, 'manifest.json'));
        };

        $scope.showManifestInFolder = function() {
            shell.showItemInFolder(fspath.join($manifest.app.path, 'manifest.json'));
        };

        // --------------------------------------------------
        // Initialization
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appDependenciesController', [
        '$session',
        '$state',
        '$stateParams',
        '$scope',
        '$manifest',
        appDependenciesController
    ]);
})();