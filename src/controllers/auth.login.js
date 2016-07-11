/*
 * Login Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function authLoginController($state, $stateParams, $scope, $environment, $session) {

        // --------------------------------------------------
        // Scope methods

        $scope.submit = function() {
            var host;
            if ($scope.isCustomHost) {
                host = $scope.data.host;
            } else {
                host = $scope.data.account + '.thinknode.io';
            }
            $environment.host(host);
            $session.login($scope.data.username, $scope.data.password).then(function() {
                $state.go('devkit.api');
            }, function(e) {
                if (e.status === 401) {
                    $scope.loginError = "Incorrect username and/or password.";
                }
                $state.go('auth.login');
            });
        };

        $scope.toggleCustomHost = function($event) {
            if (!$scope.isCustomHost && !$scope.host && $scope.account) {
                $scope.host = $scope.account + '.thinknode.io';
            }
            $scope.isCustomHost = !$scope.isCustomHost;
        };


        // --------------------------------------------------
        // Initialization

        $scope.isProfile = false;
        $scope.isCustomHost = false;
        $scope.hasCredentials = $environment.hasCredentials();
        $scope.data = {
            "account": ''
        };

        if (typeof $stateParams.username === 'string') {
            $scope.isProfile = true;
            $scope.isCustomHost = true;
            $scope.data.user = $stateParams.user;
            $scope.data.username = $stateParams.username;
            $scope.data.host = decodeURIComponent($stateParams.host);
        }
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('authLoginController', [
        '$state',
        '$stateParams',
        '$scope',
        '$environment',
        '$session',
        authLoginController
    ]);
})();