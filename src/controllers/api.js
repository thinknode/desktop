/*
 * Api Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function apiController($scope, session, $http, $docs, $sce, $document, $location, $anchorScroll, $rootScope) {
        
        // --------------------------------------------------
        // Local variables
        
        var lastService;
        var lastModule;

        var lastId;
        var lastContext;
        var routeMap;

        var buf;
        var glowTimeout = null;
        
        var deregisterInit;

        // --------------------------------------------------
        // Local requires

        var _ = require('lodash');
        var fs = require('fs');
        var msgpack = require('msgpack5')({
            forceFloat64: true
        });
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        var init = function() {
            deregisterInit();
            lastService = $scope.storage.get('lastService');
            lastModule = $scope.storage.get('lastModule');

            lastId = $scope.storage.get('id');
            lastContext = $scope.storage.get('context');
            routeMap = $scope.storage.get('routeMap');
            $docs.services().then(function(obj) {
                $scope.services = obj.items;
            });

            // Initialize the route map (responsible for remembering the last route used for each service)
            if (!routeMap) {
                routeMap = {};
                $scope.storage.set('routeMap', {});
            } else {
                if (typeof routeMap !== 'object') {
                    routeMap = {};
                    $scope.storage.set('routeMap', routeMap);
                }
            }

            // Initialize the param map (responsible for remembering params that have been entered for a route)
            $scope.paramMap = $scope.storage.get('paramMap');
            if (!$scope.paramMap) {
                $scope.paramMap = {};
                $scope.storage.set('paramMap', $scope.paramMap);
            }
            $scope.currentSession = session.current();
            $scope.current = {
                body: ""
            };
            $scope.currentParams = {};
            $scope.currentQuery = {};
            $scope.currentResultString = "";
            $scope.previousService = null;

            $scope.hasCurrentBuffer = false;

            // Set the current module to the last module/service that was set
            if (lastService && lastModule) {
                $docs.module(lastService, lastModule).then(function(obj) {
                    $scope.currentModule = obj;

                    // Set the last route used
                    if (routeMap.hasOwnProperty(lastModule)) {
                        setRoute(routeMap[lastModule].lastResourceIndex, routeMap[lastModule].lastRouteIndex);
                    } else {
                        setRoute(0, 0);
                    }
                });
            }
        };

        // --------------------------------------------------
        // Local functions

        /**
         * @summary Configures a route
         * @description
         * Configures a route after a route has been set. It will store any critical data that may be used over
         * multiple modules/routes (like context id) and also sets scope variables that control the behavior or the UI.
         */
        var configure = function() {
            // Remember last id
            if ($scope.currentParams && typeof $scope.currentParams.id === 'string') {
                lastId = $scope.currentParams.id;
                $scope.storage.set('id', lastId);
            }

            // Remember last context
            if ($scope.currentQuery && typeof $scope.currentQuery.context === 'string') {
                lastContext = $scope.currentQuery.context;
                $scope.storage.set('context', lastContext);
            }
            // Reset current settings
            var type = $scope.currentRoute.type;
            $scope.currentRoute.hasBody = type === 'post' || type === 'put' || type === 'patch';
            $scope.currentParams = $scope.paramMap[$scope.currentRoute.id].currentParams;
            $scope.currentQuery = $scope.paramMap[$scope.currentRoute.id].currentQuery;
            $scope.current.body = $scope.paramMap[$scope.currentRoute.id].currentBody;
            if ($scope.currentModule.service === $scope.previousService) {
                $scope.currentParams.id = lastId || "";
            }
            $scope.currentQuery.context = lastContext || "";
            $scope.currentResultString = "";
            $scope.showRoutes = false;
            $scope.showRequestHeaders = false;
            $scope.showResponseHeaders = false;
            $scope.hasCurrentBuffer = false;
            $scope.currentResultStatus = null;
            buf = null;
            $scope.hasCurrentBuffer = false;
            $scope.previousService = $scope.currentModule.service;
        };

        /**
         * Closes the apiRoute div when the user clicks outside of the apiRoute div
         */
        var handler = function() {
            var apiContent = angular.element($document[0].querySelectorAll('#api-content'));
            var apiRoute = angular.element($document[0].querySelectorAll('#api-route-current'));
            apiRoute.triggerHandler('click');
            apiContent.unbind('click', handler);
        };

        /**
         * @summary Sets the current route and resource
         * @description
         * Sets the current route and resource as well as stores that information into local storage.
         * @param {int} resourceIndex - The resource index.
         * @param {int} routeIndex - The resource index.
         */
        var setRoute = function(resourceIndex, routeIndex) {
            if ($scope.currentRoute && $scope.paramMap.hasOwnProperty($scope.currentRoute.id)) {
                $scope.paramMap[$scope.currentRoute.id].currentParams = $scope.currentParams;
                $scope.paramMap[$scope.currentRoute.id].currentQuery = $scope.currentQuery;
                $scope.paramMap[$scope.currentRoute.id].currentBody = $scope.current.body;
            }
            $scope.storage.set('paramMap', $scope.paramMap);
            $scope.currentResource = $scope.currentModule.resources[resourceIndex];
            $scope.currentRoute = $scope.currentResource.routes[routeIndex];
            routeMap[$scope.currentModule.id] = {
                lastResourceIndex: resourceIndex,
                lastRouteIndex: routeIndex
            };

            if (!$scope.paramMap.hasOwnProperty($scope.currentRoute.id)) {
                $scope.paramMap[$scope.currentRoute.id] = {
                    currentParams: {},
                    currentQuery: {},
                    currentBody: ""
                };
            }

            $scope.storage.set('routeMap', routeMap);
            configure();
        };

        /**
         * @summary Thin wrapper arround SessionProvider.url()
         * @param {string} route - The route to go to.
         * @param {object} params - The route params.
         * @param {object} query - The query params.
         * @returns {string} url - The complete route endpoint.
         */
        var url = function(route, params, query) {
            return session.url(route, params, query);
        };

        // --------------------------------------------------
        // Scope methods

        /**
         * @summary Ace editor callback function
         * @description
         * Ace editor callback function that is called once the ace editor has loaded. Currently its primary use is to
         * set a maximum line count on the editor so that long content will auto adjust the height of the editor. After
         * 500 lines, scrolling will take affect.
         * @param {editor} _editor - The current instance of the ace editor.
         */
        $scope.aceLoaded = function(_editor) {
            _editor.$blockScrolling = Infinity;
            _editor.setOptions({
                maxLines: 500
            });
        };

        /**
         * @summary Change service handler
         * @param {string} name - The name of the current service
         */
        $scope.changeService = function(name) {
            $docs.service(name).then(function(obj) {});
        };

        $scope.clearFile = function() {
            buf = null;
            $scope.hasCurrentBuffer = false;
        };

        $scope.clickRoute = function(event) {
            $scope.showRoutes = !$scope.showRoutes;
            event.stopPropagation();
            var apiContent = angular.element($document[0].querySelectorAll('#api-content'));
            if($scope.showRoutes) {
                // Remove the handlers left over by user clicking on left side menu
                apiContent.unbind('click', handler);
                apiContent.bind('click', handler);
            } else {
                // If the user clicks the routes multiple times this prevents bindings from stacking
                apiContent.unbind('click', handler);
            }
        };
        
        $scope.clickRequestHeaders = function(event){
            $scope.showRequestHeaders = !$scope.showRequestHeaders;
            event.stopPropagation();
        };
        $scope.clickResponseHeaders = function(event){
            $scope.showResponseHeaders = !$scope.showResponseHeaders;
            event.stopPropagation();
        };

        /**
         * @summary Logout handler
         */
        $scope.logout = function() {};

        /**
         * @summary Select file handler
         * @description
         * Used to upload a file to be used with the current route's body. Typically the file is a json file.
         */
        $scope.selectFile = function() {
            dialog.showOpenDialog(remote.getCurrentWindow(), {
                properties: ['openFile', 'openDirectory', 'multiSelections']
            }, function(filenames) {
                if (typeof filenames === 'undefined' || filenames.length !== 1) {
                    return;
                }
                fs.readFile(filenames[0], function(err, data) {
                    buf = msgpack.encode(data);
                    $scope.$apply(function() {
                        $scope.hasCurrentBuffer = true;
                    });
                });
            });
        };

        /**
         * @summary Select module handler
         * @description
         * Handles when a module is selected. It updates the route map and sets the route based on what is in the route
         * map. Also sets the current service and module into scope which is critical for the 'selectRoute()' handler.
         * @param {event} $event - The event that triggered the handler.
         * @param {string} service - The name of the current service.
         * @param {string} module - The name of the current module.
         */

        $scope.selectModule = function($event, service, module) {
            $event.stopPropagation();
            $docs.module(service, module).then(function(obj) {
                $scope.currentModule = obj;
                $scope.storage.set('lastService', service);
                $scope.storage.set('lastModule', module);

                // Set the last route used
                routeMap = $scope.storage.get('routeMap');
                if (!routeMap) {
                    routeMap = {};
                    $scope.storage.set('routeMap', routeMap);
                }

                if (routeMap.hasOwnProperty(module)) {
                    setRoute(routeMap[module].lastResourceIndex, routeMap[module].lastRouteIndex);
                } else {
                    setRoute(0, 0);
                }
            });
        };

        /**
         * @summary Select route handler
         * @description
         * Handles when a route is selected. It updates the route map and sets the route based on what is in the route
         * map.
         * @param {event} $event - The event that triggered the handler.
         * @param {int} resourceIndex - The current resource's index (ex. App Branches, App Versions are resources).
         * @param {int} routeIndex - The current route's index.
         */
        $scope.selectRoute = function($event, resourceIndex, routeIndex) {
            var apiContent = angular.element($document[0].querySelectorAll('#api-content'));
            apiContent.unbind('click', handler);
            $event.stopPropagation();
            routeMap[$scope.currentModule.id] = {
                currentParams: $scope.currentParams,
                currentQuery: $scope.currentQuery
            };
            $scope.storage.set('routeMap', routeMap);
            setRoute(resourceIndex, routeIndex);
        };

        /**
         * @summary Sends a request
         * @descriptiion Builds the request options object and then issues the request.
         */
        $scope.send = function() {
            if (glowTimeout) {
                clearTimeout(glowTimeout);
                $scope.successGlow = false;
                glowTimeout = null;
            }
            $scope.sendingRequest = true;
            for (var param in $scope.currentQuery) {
                if ($scope.currentQuery[param] === "" ||
                    !_.find($scope.currentRoute.query, "field", param)) {
                    delete $scope.currentQuery[param];
                }
            }
            var opts = {
                method: $scope.currentRoute.type,
                url: url($scope.currentRoute.url, $scope.currentParams, $scope.currentQuery),
                headers: {
                    "Authorization": "Bearer " + session.token()
                }
            };
            if ($scope.currentRoute.hasBody) {
                if (buf) {
                    opts.headers['Content-Type'] = 'application/octet-stream';
                    opts.data = new Uint8Array(buf);
                    opts.transformRequest = [];
                } else {
                    opts.headers['Content-Type'] = 'application/json';
                    opts.data = $scope.current.body;
                }
            }
            
            // Issue http request
            $http(opts).then(function(res) {
                $scope.currentResult = res.data;
                $scope.currentResultStatus = true;
                $scope.currentResultString = JSON.stringify(res.data, null, 2);
                $scope.statusCode = res.status;
                $scope.sendingRequest = false;
            }, function(err) {
                $scope.sendingRequest = false;
                $scope.currentResultStatus = false;
                $scope.currentResultString = JSON.stringify(err.data, null, 2);
                $scope.statusCode = err.status;
                $scope.lastResponse = new Date();
            }).then(function() {
                $scope.successGlow = true;
                setTimeout(function() {
                    $location.hash('bottom');
                    $anchorScroll();
                }, 10);
                glowTimeout = setTimeout(function() {
                    $scope.successGlow = false;
                    $scope.$apply();
                    glowTimeout = null;
                }, 1000);
            });
        };

        $scope.trustAsHtml = function(html) {
            return $sce.trustAsHtml(html);
        };

        // --------------------------------------------------
        // Initialization
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('apiController', [
        '$scope',
        'session',
        '$http',
        '$docs',
        '$sce',
        '$document',
        '$location',
        '$anchorScroll',
        '$rootScope',
        apiController
    ]);
})();