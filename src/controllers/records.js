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
        var memcache = {};

        // --------------------------------------------------
        // Local requires

        var fs = require('fs');
        var msgpack = require('msgpack5')({
            forceFloat64: true
        });
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        var init = function() {
            deregisterInit();
            $scope.context = $scope.storage.get('context');
            $scope.refresh();
        };

        // --------------------------------------------------
        // Local functions

        function deserialize(entries) {
            for (var i = 0; i < entries.length; ++i) {
                entries[i].modified_at = new Date(entries[i].modified_at);
            }
            return entries;
        }

        function resolveData(immutable) {
            var key = $scope.context + "-" + immutable;
            if (typeof memcache[key] !== "undefined") {
                return $q.resolve(memcache[key]);
            } else {
                return $http({
                    method: "HEAD",
                    url: session.url("/iss/immutable/:id", {
                        "id": immutable
                    }, {
                        "context": $scope.context
                    }),
                    headers: {
                        "Authorization": "Bearer " + session.token(),
                        "Accept": "application/json"
                    }
                }).then(function(res) {
                    memcache[key] = {
                        "size": parseInt(res.headers("Thinknode-Size"))
                    };
                    if (memcache[key].size <= 5000000) {
                        return $http({
                            method: "GET",
                            url: session.url("/iss/immutable/:id", {
                                "id": immutable
                            }, {
                                "context": $scope.context
                            }),
                            headers: {
                                "Authorization": "Bearer " + session.token(),
                                "Accept": "application/json"
                            }
                        }).then(function(res) {
                            if (res.status === 200) {
                                memcache[key].body = JSON.stringify(res.data, null, 2);
                                return memcache[key];
                            }
                        }, function(res) {
                            return $q.reject(new Error(res.data.message));
                        });
                    } else {
                        return memcache[key];
                    }
                });
            }
        }

        function resolveImmutable(id) {
            var key = $scope.context + "-" + id;
            if (typeof memcache[key] !== "undefined") {
                return $q.resolve(memcache[key]);
            } else {
                return $http({
                    method: "GET",
                    url: session.url("/iss/:id/immutable", {
                        "id": id
                    }, {
                        "context": $scope.context
                    }),
                    headers: {
                        "Authorization": "Bearer " + session.token()
                    }
                }).then(function(res) {
                    if (res.status === 200) {
                        memcache[key] = res.data.id;
                        return memcache[key];
                    } else if (res.status === 202) {
                        return $q.reject(new Error("Incomplete calculation for id: " + id));
                    } else if (res.status === 204) {
                        return $q.reject(new Error("Failed calculation for id: " + id));
                    }
                });
            }
        }

        function getObject(id) {
            return resolveImmutable(id).then(function(immutable) {
                return resolveData(immutable);
            });
        }

        function queryEntries(parent, start) {
            var query = {
                context: $scope.context,
                depth: 0,
                limit: 10
            };
            if (parent) {
                query.parent = parent;
                query.depth = 1;
            }
            if (start) {
                query.start = start;
            }
            return $http({
                method: "GET",
                url: session.url("/rks", null, query),
                headers: {
                    "Authorization": "Bearer " + session.token()
                }
            });
        }

        // --------------------------------------------------
        // Scope variables

        $scope.context = null;
        $scope.levels = [];
        $scope.selected = null;
        $scope.focus = "hierarchy";

        // --------------------------------------------------
        // Scope methods

        /**
         * @summary Called by the ace editor provider when the ace editor has been loaded.
         *
         * @param {object} _editor - The editor.
         */
        $scope.aceLoaded = function(_editor) {
            _editor.$blockScrolling = Infinity;
            _editor.setOptions({
                maxLines: 500
            });
        };

        /**
         * @summary Closes the settings modal.
         */
        $scope.close = function() {
            $mdDialog.hide();
        };

        /**
         * @summary Refreshes the state of the visualizer hierarchy.
         * @description
         * This should be used
         *
         * @param {boolean} force - Indicates whether the refresh operation should be forced (in the
         *   case that the user has entered in a new context, for instance)
         * @returns {Promise} An angular promise that resolves when the root-level entries have been
         *   retrieved. It will also resolve if the context is invalid and cannot be used in the
         *   query.
         */
        $scope.refresh = function(force) {
            if (refreshPromise && !force) {
                return refreshPromise;
            }
            if (!$scope.context || !/^[a-zA-Z0-9]{32}$/.test($scope.context)) {
                return (refreshPromise = $q.resolve());
            }
            return (refreshPromise = queryEntries().then(function(res) {
                // Deserialize dates
                var data = deserialize(res.data);
                // Add initial level
                $scope.levels = [];
                var level = {
                    "parent": null,
                    "next": res.headers('Thinknode-Next'),
                    "entries": data,
                    "filter": ""
                };
                $scope.levels.push(level);
                if (level.next) {
                    return $scope.nextPage($scope.levels.length - 1);
                }
            }));
        };

        /**
         * @summary Opens the modal to modify the Visualizer settings.
         *
         * @param {object} e - The event object.
         */
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

        /**
         * @summary Queries for the next page of entries.
         *
         * @param {number} index - The index representing the selected level in which to load more
         *   entries.
         */
        $scope.nextPage = function(index) {
            var level = $scope.levels[index];
            return queryEntries(level.parent, level.next).then(function(res) {
                // Deserialize dates
                var data = deserialize(res.data);
                // Add entries to level and set new next value
                level.entries = level.entries.concat(data);
                level.next = res.headers("Thinknode-Next");
                if (level.next) {
                    return $scope.nextPage(index);
                }
            });
        };

        /**
         * @summary Selected an entry from the list of entries.
         * @description
         * Selecting an entry causes (1) that entry to be displayed in the entry details pane on
         * the righthand side of the screen and (2) the entry's children to be displayed in another
         * result column.
         *
         * @param {number} level - The index representing the index of the level in which the
         *   selected entry belongs.
         * @param {number} entry - The index representing the index of the selected entry in the
         *   list of entries.
         */
        $scope.selectEntry = function(level, entry) {
            $scope.levels = $scope.levels.slice(0, level + 1);
            var entries = $scope.levels[level].entries;
            for (var i = 0; i < entries.length; ++i) {
                entries[i].selected = (i === entry);
            }
            $scope.selected = entries[entry];
            return getObject($scope.selected.immutable).then(function(obj) {
                $scope.selected.data = obj;
                return queryEntries($scope.selected.id);
            }).then(function(res) {
                // Deserialize dates
                var data = deserialize(res.data);
                // Add new level
                var level = {
                    "parent": $scope.selected.id,
                    "next": res.headers('Thinknode-Next'),
                    "entries": data,
                    "filter": ""
                };
                $scope.levels.push(level);
                if (level.next) {
                    return $scope.nextPage($scope.levels.length - 1);
                }
            });
        };

        /**
         * @summary Saves the data to a file.
         *
         * @param {string} type - The type of the data (either "json" or "octet-stream").
         */
        $scope.save = function(type) {
            dialog.showSaveDialog(function(filename) {
                if (typeof filename === "undefined") {
                    return;
                }
                return resolveImmutable($scope.selected.immutable).then(function(immutable) {
                    request.get({
                        uri: session.url("/iss/immutable/:id", {
                            id: immutable
                        }, {
                            context: $scope.context
                        }),
                        headers: {
                            "Authorization": "Bearer " + session.token(),
                            "Accept": "application/" + type
                        }
                    }).on("error", function(e) {
                        console.log("error");
                    }).pipe(fs.createWriteStream(filename));
                });
            });
        };

        // --------------------------------------------------
        // Initialization
        deregisterInit = $rootScope.$on('initialized', init);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Filter

    function entryFilter() {
        // Accepted filter fields
        // * id
        // * ref
        // * name
        // * record
        var fields = ["id", "ref", "name", "record"];
        return function(input, filter) {
            if (filter === "") {
                return input;
            }
            var strings = [];
            var obj = {};
            // Parse Filter object
            var i, j, part, subparts, parts;
            parts = filter.split(" ");
            for (i = 0; i < parts.length; ++i) {
                part = parts[i];
                if (part.indexOf(":") > -1) {
                    subparts = part.split(":");
                    if (fields.indexOf(subparts[0]) > -1) {
                        obj[subparts[0]] = subparts[1];
                    } else {
                        strings.push(part);
                    }
                } else {
                    strings.push(part);
                }
            }
            // Use filter objects to construct final collection
            var collection = [];
            var item, failed, found, temp;
            for (i = 0; i < input.length; ++i) {
                item = input[i];
                failed = false;
                // Check whether item is selected
                if (item.selected) {
                    collection.push(item);
                    continue;
                }
                // Check id field
                if (obj.id && item.id.indexOf(obj.id) < 0) {
                    failed = true;
                }
                // Check ref field
                if (obj.ref && item.immutable.indexOf(obj.ref) < 0) {
                    failed = true;
                }
                // Check name field
                if (obj.name && item.name.indexOf(obj.name) < 0) {
                    failed = true;
                }
                // Check record field
                if (obj.record) {
                    temp = item.record.account + "/" + item.record.app + "/" + item.record.name;
                    if (temp.indexOf(obj.record) < 0) {
                        failed = true;
                    }
                }
                // Check name against strings
                found = false;
                for (j = 0; j < strings.length; ++j) {
                    if (item.name.indexOf(strings[j]) > -1) {
                        found = true;
                        break;
                    }
                }
                if (strings.length > 0 && !found) {
                    failed = true;
                }
                // Add to collection if filter applies
                if (!failed) {
                    collection.push(item);
                }
            }
            return collection;
        };
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
    ]).filter('entry', entryFilter);
})();