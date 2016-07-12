/*
 * App Types Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appDefinitionsController($rootScope, $params, $scope, $manifest) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');

        // --------------------------------------------------
        // Scope variables

        $scope.apps = [];

        $scope.add = {
            visible: false,
            processing: false,
            item: {}
        };

        $scope.items = $manifest[$params.cls];

        $scope.singularCls = $params.cls.charAt(0).toUpperCase() +
            $params.cls.slice(1, $params.cls.length - 1);

        $scope.current = {
            "item": null,
            "schema": "",
            "valid": true
        };

        $scope.execution_classes = [
            "cpu.x1",
            "cpu.x2",
            "cpu.x4",
            "cpu.x8",
            "cpu.x16",
            "cpu.x32"
        ];

        // --------------------------------------------------
        // Scope methods

        $scope.addItem = function() {
            $scope.add.visible = true;
        };

        $scope.addItemCancel = function() {
            $scope.add.visible = false;
        };

        $scope.addItemSubmit = function() {
            $scope.addItemDuplicate = false;
            var index = _.findIndex($scope.items, 'name', $scope.add.item.name);
            if (index >= 0) {
                $scope.addItemDuplicate = true;
            } else {
                var item = {
                    "name": $scope.add.item.name,
                    "description": $scope.add.item.description,
                    "dirty": true,
                    "schema": {}
                };
                $scope.items.push(item);
                $scope.setCurrent(item);
                $scope.add.visible = false;
            }
        };

        $scope.aceLoaded = function(_editor) {
            _editor.$blockScrolling = Infinity;

            _editor.getSession().on('changeAnnotation', function() {
                var annotations = _editor.getSession().getAnnotations();
                if (annotations.length > 0) {
                    $scope.current.valid = false;
                } else {
                    try {
                        var obj = JSON.parse(_editor.getSession().getValue());
                        if (!_.isEqual(obj, $scope.current.item.schema)) {
                            $scope.current.item.dirty = true;
                            $scope.current.item.schema = obj;
                        }
                        $scope.current.valid = true;
                    } catch (e) {
                        $scope.current.valid = false;
                    }
                }
                $scope.$apply();
            });
        };

        $scope.filterItems = function(value, index, array) {
            return !$scope.filterText || value.name.indexOf($scope.filterText) >= 0 ||
                value.description.indexOf($scope.filterText) >= 0;
        };

        $scope.delete = function(cls) {
            return $manifest.delete(cls, $scope.current.item.name).then(function() {
                var index = _.findIndex($scope.items, 'name', $scope.current.item.name);
                $scope.items.splice(index, 1);
                $scope.resetCurrent();
                $scope.$apply();
            });
        };

        $scope.save = function(cls) {
            return $manifest.save(cls, $scope.current.item.name);
        };

        $scope.saveAll = function() {
            return $manifest.saveAll();
        };

        $scope.setCurrent = function(item) {
            if (typeof item !== 'undefined') {
                $scope.current.item = item;
                $scope.current.schema = JSON.stringify(item.schema, null, 2);
            } else {
                return item;
            }
        };

        $scope.resetCurrent = function() {
            $scope.current.item = null;
            $scope.current.schema = "";
            $scope.current.valid = true;
            $scope.current.execution_class = "";
        };

        $scope.unlinkApp = function(app) {
            console.log("repair app", app);
        };

        // --------------------------------------------------
        // Initialization
        
        function init() {
            // Initializtion logic that depends on environment or session services goes here
        }
        
        $rootScope.$on('initilized', init);
        
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appDefinitionsController', [
        '$rootScope',
        '$state',
        '$stateParams',
        '$scope',
        '$manifest',
        appDefinitionsController
    ]);
})();