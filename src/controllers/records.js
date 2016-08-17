/*
 * Api Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function recordsController($scope, session, $http, $document, $location, $rootScope, $mdDialog) {
        
        // --------------------------------------------------
        // Local variables
        
        var deregisterInit;

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

        $scope.refresh = function() {
            console.log('refresh');
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
        '$document',
        '$location',
        '$rootScope',
        '$mdDialog',
        recordsController
    ]);
})();