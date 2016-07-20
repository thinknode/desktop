/*
 * App Provider Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appProviderController($rootScope, $scope, $manifest) {

        // --------------------------------------------------
        // Required modules

        var fspath = require('path');
        var remote = require('remote');
        var shell = remote.require('shell');
        
        var deregisterInit;

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
        
        function init() {
            // Initializtion logic that depends on environment or session services goes here
            deregisterInit();
        }
        
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appProviderController', [
        '$rootScope',
        '$scope',
        '$manifest',
        appProviderController
    ]);
})();