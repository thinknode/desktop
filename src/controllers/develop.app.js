/*
 * App Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function () {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appController($rootScope, session, $manifest, $stateParams, $scope) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');

        // --------------------------------------------------
        // Local functions
        
        var deregisterInit;
        
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

        $scope.unlinkApp = function (app) {
            console.log("repair app", app);
        };

        // --------------------------------------------------
        // Initialization

        function init() {
            deregisterInit();
            $scope.app = _.find(session.apps, 'name', $stateParams.app);
            $manifest.load($scope.app);
            $scope.$apply();
        }
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appController', [
        '$rootScope',
        'session',
        '$manifest',
        '$stateParams',
        '$scope',
        appController
    ]);
})();