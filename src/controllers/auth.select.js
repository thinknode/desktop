/*
 * Chooser Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function () {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function authSelectController($rootScope, $state, $scope, session, environment) {

        // --------------------------------------------------
        // Scope methods

        $scope.select = function ($event, profile) {
            session.validate(profile).then(function () {
                $state.go('devkit.api');
            }).catch(function (err) {
                $state.go('auth.login', {
                    "user": profile.name,
                    "username": profile.username,
                    "host": profile.host
                });
            });
        };

        // --------------------------------------------------
        // Initialization
        
        function init() {
            if (!environment.hasCredentials()) {
                $state.go('auth.login');
            }
            
            $scope.profiles = environment.credentials();
            $scope.$apply();
        }

        $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('authSelectController', [
        '$rootScope',
        '$state',
        '$scope',
        'session',
        'environment',
        authSelectController
    ]);
})();