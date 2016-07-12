/*
 * Chooser Controller
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function appDebugController($rootScope, session, $state, $scope, $proxy, $http, $logger) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');

        // --------------------------------------------------
        // Local variables

        var namespace = session.namespace();
        var app = $state.params.app;
        var branchKey = namespace + ".debug." + app + ".branch";
        var realmKey = namespace + ".debug." + app + ".realm";
        var portKey = namespace + ".debug." + app + ".port";

        // --------------------------------------------------
        // Local functions

        /**
         * @summary Turns the proxy server and local calculation supervisor off.
         */
        function close() {
            $proxy.close().then(function() {
                session.debug(false, app);
                $scope.$apply();
            });
        }

        /**
         * @summary Catches an error and ignores it.
         */
        function ignore() {}

        /**
         * @summary Turns the proxy server and local calculation supervisor on.
         * @description
         * This function is responsible for first checking whether the selected branch is installed
         * in the selected realm. If it is not, it attempts to remedy the realm configuration
         * automatically with the user's permission. Once the configuration is correct, it obtains
         * a realm context, tells the proxy to start listening, and tells the session provider the
         * proxy endpoint to start using.
         */
        function listen() {
            $http({
                "method": 'GET',
                "url": session.url('/iam/realms/:realm/branches', {
                    "realm": $scope.realm.name
                }),
                "headers": {
                    "Authorization": 'Bearer ' + session.token()
                }
            }).then(function(res) {
                var installed = _.findWhere(res.data, {
                    "account": session.current().domain,
                    "app": app
                });
                if (!installed) {
                    return $scope.showInstallBranch();
                } else if (installed.branch !== $scope.branch.name) {
                    $scope.installForce.current = installed.branch;
                    return $scope.showInstallForceBranch();
                }
            }).then(function() {
                return $http({
                    "method": 'GET',
                    "url": session.url('/iam/realms/:realm/context', {
                        "realm": $scope.realm.name
                    }),
                    "headers": {
                        "Authorization": 'Bearer ' + session.token()
                    }
                });
            }).then(function(res) {
                return $proxy.listen({
                    "account": session.current().domain,
                    "app": app,
                    "context": res.data.id,
                    "port": $scope.port,
                    "callback": $scope.notify
                });
            }).then(function() {
                session.debug('http://localhost:4345', app);
            }).catch(ignore);
        }

        // --------------------------------------------------
        // Scope members

        $scope.installForce = {
            "current": null,
            "visible": false,
            "resolve": null,
            "reject": null
        };

        $scope.install = {
            "visible": false,
            "resolve": null,
            "reject": null
        };

        $scope.logs = $logger.logs;

        $scope.info = $proxy.info;

        $scope.port = null;
        $scope.branches = null;
        $scope.branch = null;
        $scope.realms = null;
        $scope.realm = null;

        // --------------------------------------------------
        // Scope methods

        /**
         * @summary Cancels starting the proxy.
         *
         * @param {string} action - The action to cancel.
         */
        $scope.cancel = function(action) {
            var reject = $scope[action].reject;
            $scope[action].resolve = null;
            $scope[action].reject = null;
            $scope[action].visible = false;
            reject();
        };

        /**
         * @summary Saves the currently selected branch.
         */
        $scope.changeBranch = function() {
            localStorage.setItem(branchKey, $scope.branch.name);
        };

        /**
         * @summary Saves the currently selected realm.
         */
        $scope.changeRealm = function() {
            localStorage.setItem(realmKey, $scope.realm.name);
        };

        /**
         * @summary Saves the currently selected port.
         */
        $scope.changePort = function() {
            if (typeof $scope.port === 'number') {
                localStorage.setItem(portKey, $scope.port);
            }
        };

        /**
         * @summary Clears the calculation cache.
         */
        $scope.clearCache = function() {
            $logger.append('debug', 'Clearing calculation cache');
            $scope.clearing = true;
            session.clearCache().then(function() {
                return $proxy.clear();
            }).then(function() {
                $logger.append('debug', 'Cache cleared');
                $scope.clearing = false;
                $scope.$apply();
            });
        };

        /**
         * @summary Clears all proxy logs.
         */
        $scope.clearLogs = function() {
            $logger.clear();
        };

        /**
         * @summary Initializes the debug controller.
         * @description
         * This function is responsible for querying the API for a list of branches for the current
         * app and a list of development realms, both based on the user's permissions.
         */
        $scope.init = function() {
            var selectedBranch = localStorage.getItem(branchKey);
            var selectedRealm = localStorage.getItem(realmKey);
            var selectedPort = localStorage.getItem(portKey);
            if (selectedPort) {
                $scope.port = parseInt(selectedPort);
            } else {
                $scope.port = 17234;
                localStorage.setItem(portKey, $scope.port);
            }
            $http({
                "method": 'GET',
                "url": session.url('/apm/apps/:account/:app/branches', {
                    "account": session.current().domain,
                    "app": $state.params.app
                }),
                "headers": {
                    "Authorization": 'Bearer ' + session.token()
                }
            }).then(function(res) {
                $scope.branches = res.data;
                // If user has selected a branch and it still exists, use that branch. Otherwise,
                // use the first branch in the list of branches.
                if (selectedBranch) {
                    var branch = _.find($scope.branches, _.matchesProperty("name", selectedBranch));
                    if (branch) {
                        $scope.branch = branch;
                    } else {
                        $scope.branch = $scope.branches[0];
                    }
                } else {
                    $scope.branch = $scope.branches[0];
                }
                localStorage.setItem(branchKey, $scope.branch.name);
                return $http({
                    "method": 'GET',
                    "url": session.url('/iam/realms', null, {
                        "development": true
                    }),
                    "headers": {
                        "Authorization": 'Bearer ' + session.token()
                    }
                });
            }).then(function(res) {
                $scope.realms = res.data;
                // If user has selected a realm and it still exists, use that realm. Otherwise, use
                // the first realm in the list of realms.
                if (selectedRealm) {
                    var realm = _.find($scope.realms, _.matchesProperty("name", selectedRealm));
                    if (realm) {
                        $scope.realm = realm;
                    } else {
                        $scope.realm = $scope.realms[0];
                    }
                } else {
                    $scope.realm = $scope.realms[0];
                }
                if ($scope.realm) {
                    localStorage.setItem(realmKey, $scope.realm.name);
                } else {
                    localStorage.removeItem(realmKey);
                }
                $scope.$apply();
            });
        };

        /**
         * @summary Installs the selected branch into the selected realm.
         */
        $scope.installBranch = function() {
            return $http({
                method: 'PUT',
                url: session.url('/iam/realms/:realm/branches/:account/:app/:branch', {
                    'realm': $scope.realm.name,
                    'account': session.current().domain,
                    'app': $state.params.app,
                    'branch': $scope.branch.name
                }),
                headers: {
                    'Authorization': 'Bearer ' + session.token()
                }
            }).then(function() {
                var resolve = $scope.install.resolve;
                $scope.install.resolve = null;
                $scope.install.reject = null;
                $scope.install.visible = false;
                resolve();
            });
        };

        /**
         * @summary Installs the selected branch into the selected realm by first uninstalling the
         *   currently installed branch.
         */
        $scope.installBranchForce = function() {
            return $http({
                "method": 'DELETE',
                "url": session.url('/iam/realms/:realm/branches/:account/:app/:branch', {
                    "realm": $scope.realm.name,
                    "account": session.current().domain,
                    "app": $state.params.app,
                    "branch": $scope.installForce.current
                }),
                "headers": {
                    "Authorization": 'Bearer ' + session.token()
                }
            }).then(function() {
                $http({
                    "method": 'PUT',
                    "url": session.url('/iam/realms/:realm/branches/:account/:app/:branch', {
                        "realm": $scope.realm.name,
                        "account": session.current().domain,
                        "app": $state.params.app,
                        "branch": $scope.branch.name
                    }),
                    "headers": {
                        "Authorization": 'Bearer ' + session.token()
                    }
                });
            }).then(function() {
                var resolve = $scope.installForce.resolve;
                $scope.installForce.current = null;
                $scope.installForce.resolve = null;
                $scope.installForce.reject = null;
                $scope.installForce.visible = false;
                resolve();
            });
        };

        /**
         * @summary A callback function to be used when the proxy or supervisor updates its status.
         */
        $scope.notify = function() {
            $scope.$apply();
        };

        /**
         * @summary Pings a provider.
         */
        $scope.pingProvider = function() {
            $proxy.ping().then(function() {
                $scope.$apply();
            });
        };

        /**
         * @summary Show the dialog requesting that the currently installed branch be uninstalled
         *   from the realm and the selected branch be installed in the realm.
         *
         * @returns {Promise} A promise that resolves when the user has either accepted or declined
         *   the request to uninstall the currently installed branch and install the selected one.
         */
        $scope.showInstallForceBranch = function() {
            /* jshint newcap: false */
            return new bluebird(function(resolve, reject) {
                $scope.installForce.visible = true;
                $scope.installForce.resolve = resolve;
                $scope.installForce.reject = reject;
            });
        };

        /**
         * @summary Show the dialog requesting that the selected branch be installed in the realm.
         *
         * @returns {Promise} A promise that resolves when the user has either accepted or declined
         *   the request to install the branch in the realm.
         */
        $scope.showInstallBranch = function() {
            /* jshint newcap: false */
            return new bluebird(function(resolve, reject) {
                $scope.install.visible = true;
                $scope.install.resolve = resolve;
                $scope.install.reject = reject;
            });
        };

        /**
         * @summary Toggling whether the proxy is on or off.
         */
        $scope.toggle = function() {
            if ($scope.info.enabled) {
                close();
            } else {
                listen();
            }
        };



        // --------------------------------------------------
        // Initialization

        $rootScope.$on('initialized', $scope.init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('appDebugController', [
        '$rootScope',
        'session',
        '$state',
        '$scope',
        '$proxy',
        '$http',
        '$logger',
        appDebugController
    ]);
})();