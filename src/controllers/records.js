/*
 * Api Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function recordsController($scope, session, $http, $q, $location, $rootScope, $mdDialog) {
        
        // --------------------------------------------------
        // Local variables
        
        var deregisterInit;
        var refreshPromise;

        // --------------------------------------------------
        // Local requires

        var fs = require('fs');
        var msgpack = require('msgpack5')({
            forceFloat64: true
        });
        // var request = require('request');
        // var remote = require('remote');
        // var dialog = remote.require('dialog');

        var init = function() {
            deregisterInit();
        };

        // --------------------------------------------------
        // Local functions

        // --------------------------------------------------
        // Scope variables

        $scope.context = null;
        $scope.levels = [];
        $scope.body = JSON.stringify({
            "hello": "world"
        }, null, 4);

        // --------------------------------------------------
        // Scope methods

        $scope.aceLoaded = function(_editor) {
            console.log("Ace Loaded");
            _editor.$blockScrolling = Infinity;
            _editor.setOptions({
                maxLines: 500
            });
        };

        /**
         * @summary Refreshes the state of the visualizer hierarchy.
         * @description
         * This should be used
         *
         * @returns {Promise} An angular promise that resolves when the root-level entries have been
         *   retrieved. It will also resolve if the context is invalid and cannot be used in the
         *   query.
         */
        $scope.refresh = function() {
            console.log('refresh');
            if (refreshPromise) {
                return refreshPromise;
            }
            if (!$scope.context || !$scope.context.test(/^[a-zA-Z0-9]{32}$/)) {
                return (refreshPromise = $q.resolve());
            }
            return (refreshPromise = $http({
                method: "GET",
                url: session.url("/rks", null, {
                    context: $scope.context,
                    depth: 1
                }),
                headers: {
                    "Authorization": "Bearer " + session.token()
                }
            }));
        };

        $scope.modifySettings = function(e) {
            e.stopPropagation();
            e.preventDefault();
            $mdDialog.show({
                clickOutsideToClose: true,
                scope: $scope,
                targetEvent: e,
                templateUrl: 'recordsSettings.tmpl.html',
                preserveScope: true,
                onShowing: function() {
                    $scope.open = true;
                },
                onRemoving: function() {
                    $scope.open = false;
                }
            });
        };

        // --------------------------------------------------
        // Initialization
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('recordsController', [
        '$scope',
        'session',
        '$http',
        '$q',
        '$location',
        '$rootScope',
        '$mdDialog',
        recordsController
    ]);
})();