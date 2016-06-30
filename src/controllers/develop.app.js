/*
 * App Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appController($environment, $session, $manifest, $state, $stateParams, $scope) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');
        var fs = bluebird.promisifyAll(require('fs'));
        var fspath = require('path');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        // --------------------------------------------------
        // Local variables

        var apps = $environment.db().getSchema().table('apps');

        // --------------------------------------------------
        // Local functions

        // --------------------------------------------------
        // Scope variables

        $scope.apps = [];

        $scope.create = {
            visible: false,
            processing: false,
            app: {}
        };

        // --------------------------------------------------
        // Scope methods

        $scope.unlinkApp = function(app) {
            console.log("repair app", app);
        };

        // --------------------------------------------------
        // Initialization

        // $scope.refresh();

        $scope.app = _.find($session.apps, 'name', $stateParams.app);

        $manifest.load($scope.app);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appController', [
        '$environment',
        '$session',
        '$manifest',
        '$state',
        '$stateParams',
        '$scope',
        appController
    ]);
})();