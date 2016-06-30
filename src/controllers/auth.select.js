/*
 * Chooser Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function authSelectController($state, $scope, $session, $environment, $location) {

        // --------------------------------------------------
        // Scope methods

        $scope.select = function($event, profile) {
            $session.validate(profile).then(function() {
                $state.go('devkit.api');
            }).catch(function(err) {
                $state.go('auth.login', {
                    "user": profile.name,
                    "username": profile.username,
                    "host": profile.host
                });
            });
        };

        // --------------------------------------------------
        // Initialization

        if (!$environment.hasCredentials()) {
            $state.go('auth.login');
        }

        $scope.profiles = $environment.credentials();
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('authSelectController', [
        '$state',
        '$scope',
        '$session',
        '$environment',
        '$location',
        authSelectController
    ]);
})();