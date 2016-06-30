/*
 * App Details Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appDetailsController($environment, $session, $state, $params, $scope, $http) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');

        // --------------------------------------------------
        // Local variables

        var fields = ['display_name', 'description', 'active'];

        // --------------------------------------------------
        // Local functions

        // --------------------------------------------------
        // Scope variables

        $scope.app = null;

        $scope.activeOptions = [{
            value: true,
            label: 'Yes'
        }, {
            value: false,
            label: 'No'
        }];

        $scope.update = {
            processing: false,
            app: {}
        };

        // --------------------------------------------------
        // Scope methods

        $scope.refresh = function() {
            return $http({
                method: 'GET',
                url: $session.url('/apm/apps/:account/:app', {
                    'account': $session.current().domain,
                    'app': $params.app
                }),
                headers: {
                    'Authorization': 'Bearer ' + $session.token()
                }
            }).then(function(res) {
                $scope.app = res.data;
                $scope.update.app = _.cloneDeep(res.data);
            });
        };

        $scope.submit = function() {
            var body = {};
            for (var i = 0; i < fields.length; ++i) {
                if ($scope.update.app[fields[i]] !== $scope.app[fields[i]]) {
                    body[fields[i]] = $scope.update.app[fields[i]];
                }
            }
            if (_.isEmpty(body)) {
                return;
            }
            $scope.update.processing = true;
            return $http({
                method: 'PATCH',
                url: $session.url('/apm/apps/:account/:app', {
                    'account': $session.current().domain,
                    'app': $params.app
                }),
                headers: {
                    'Authorization': 'Bearer ' + $session.token(),
                    'Content-Type': 'application/json'
                },
                data: body
            }).then(function(res) {
                $scope.app = res.data;
                return $session.updateApp(res.data);
            }).then(function() {
                $scope.update.app = $scope.app;
                $scope.update.processing = false;
            });
        };

        // --------------------------------------------------
        // Initialization

        $scope.refresh();
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appDetailsController', [
        '$environment',
        '$session',
        '$state',
        '$stateParams',
        '$scope',
        '$http',
        appDetailsController
    ]);
})();