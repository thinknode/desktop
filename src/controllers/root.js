/*
 * Root Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function rootController($state, $scope, $session, $http, $sce, notifications) {

        // --------------------------------------------------
        // Local variables

        var fs = require('fs');
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        // --------------------------------------------------
        // Local functions

        // --------------------------------------------------
        // Scope methods

        $scope.logout = function() {
            $session.logout();
            $state.go('auth.select');
        };

        $scope.switch = function() {
            $session.switch();
            $state.go('auth.select');
        };

        $scope.closeApp = function($event, app) {
            $event.stopPropagation();
            $event.preventDefault();
            var empty = $session.closeApp(app.name);
            if (empty) {
                $state.go('devkit.apps');
            } else {
                var isCurrent = $state.is('devkit.app.details', {
                    "app": app.name
                });
                if (isCurrent) {
                    $state.go('devkit.apps');
                }
            }
        };

        $scope.init = function() {
            var msg = '<span class="updateLink" onclick="helpers.openDownloadPage()">' +
                'A new version is available for download: Click here to download</span>';
            var version = "1.1.0";
            var request = $http({
                method: "get",
                url: "https://s3.amazonaws.com/thinknode-desktop-client/current.json"
            });
            return request.then(function(res) {
                if(res.data.version !== version) {
                    notifications.showWarning({
                        message: $sce.trustAsHtml(msg)
                    });
                }
            });
        };

        // --------------------------------------------------
        // Initialization

        $scope.currentSession = $session.current();

        $scope.openApps = $session.openApps;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('rootController', [
        '$state',
        '$scope',
        '$session',
        '$http',
        '$sce',
        'notifications',
        rootController
    ]);
})();
