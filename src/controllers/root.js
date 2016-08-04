/*
 * Root Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function rootController($rootScope, $state, $scope, session, $http, $sce, notifications) {
        
        var deregisterInit;
        
        // --------------------------------------------------
        // Scope methods

        $scope.logout = function() {
            session.logout();
            $state.go('auth.select');
        };

        $scope.switch = function() {
            session.switch();
            $state.go('auth.select');
        };

        $scope.closeApp = function($event, app) {
            $event.stopPropagation();
            $event.preventDefault();
            var empty = session.closeApp(app.name);
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
            var version = "1.2.1";
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
        
        function init(){
            deregisterInit();
            $scope.currentSession = session.current();
            $scope.openApps = session.openApps;
            $scope.$apply();
        }
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('rootController', [
        '$rootScope',
        '$state',
        '$scope',
        'session',
        '$http',
        '$sce',
        'notifications',
        rootController
    ]);
})();
