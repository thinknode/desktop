/*
 * Records Controller
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function recordsController($scope, session, $http, $q, $location, $rootScope, $timeout, $mdDialog) {

        // --------------------------------------------------
        // Local variables

        var deregisterInit;
        var refreshPromise;
        var memcache = {};

        // --------------------------------------------------
        // Local requires

        var _ = require('lodash');
        var fs = require('fs');
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        var init = function() {
            deregisterInit();
            $scope.context = $scope.storage.get('context');
            $scope.inactive = $scope.storage.get('inactive') || false;
            var map = $scope.storage.get('selectedRecords') || {};
            $scope.refresh(false, map[$scope.context]);
        };

        // --------------------------------------------------
        // Local functions

        /** 
         * @summary Given a reference id, retrieves the object.
         *
         * @param {string} id - The reference id.
         * @returns {object} An object containing properties for the size, body, and type of the
         *   object.
         */
        function getObject(id) {
            return resolveImmutable(id).then(function(obj) {
                return resolveData(obj.immutable).then(function(data) {
                    data.type = obj.type;
                    return data;
                });
            });
        }

        /** 
         * @summary Inspects the current context.
         *
         * @returns {object} Information about the context including the bucket and contents.
         */
        function inspectContext() {
            return $http({
                method: "GET",
                url: session.url("/iam/contexts/:id", {
                    "id": $scope.context
                }),
                headers: {
                    "Authorization": "Bearer " + session.token(),
                    "Accept": "application/json"
                }
            }).then(function(res) {
                return res.data;
            });
        }

        /** 
         * @summary Queries for record entries for the current context.
         *
         * @param {string} [parent] - The id of the parent record entry.
         * @param {string} [start] - If provided, retrieves the next page of entries starting at the
         *   provided id.
         * @returns {object} A list of record entries.
         */
        function queryEntries(parent, start) {
            var query = {
                context: $scope.context,
                inactive: $scope.inactive,
                depth: 0
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

        /** 
         * @summary Given an immutable id, retrieves the data.
         *
         * @param {string} immutable - The immutable id.
         * @returns {object} An object containing properties for the size and (if below 5MB) the
         *   data itself.
         */
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

        /** 
         * @summary Given a reference id, retrieves the immutable id.
         *
         * @param {string} id - The reference id.
         * @returns {object} An object containing properties for the immutable id and the type of
         *   the data.
         */
        function resolveImmutable(id) {
            var key = $scope.context + "-" + id;
            if (typeof memcache[key] !== "undefined") {
                return $q.resolve(memcache[key]);
            } else {
                memcache[key] = {};
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
                        memcache[key].immutable = res.data.id;
                    } else if (res.status === 202) {
                        return $q.reject(new Error("Incomplete calculation for id: " + id));
                    } else if (res.status === 204) {
                        return $q.reject(new Error("Failed calculation for id: " + id));
                    }
                }).then(function() {
                    return $http({
                        method: "HEAD",
                        url: session.url("/iss/:id", {
                            "id": id
                        }, {
                            "context": $scope.context
                        }),
                        headers: {
                            "Authorization": "Bearer " + session.token()
                        }
                    });
                }).then(function(res) {
                    memcache[key].type = res.headers("Thinknode-Type");
                    return memcache[key];
                });
            }
        }

        // --------------------------------------------------
        // Scope variables

        $scope.context = null;
        $scope.inactive = false;
        $scope.levels = [];
        $scope.selected = null;
        $scope.focus = "hierarchy";
        $scope.fullscreen = false;
        $scope.bucket = null;

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
                maxLines: 50
            });
        };

        /**
         * @summary Called by the ace editor provider when the ace editor has been loaded.
         *
         * @param {object} _editor - The editor.
         */
        $scope.aceLoadedFullscreen = function(_editor) {
            _editor.$blockScrolling = Infinity;
            _editor.setOptions({
                maxLines: Infinity
            });
        };

        /**
         * @summary Closes the settings modal.
         */
        $scope.close = function() {
            $mdDialog.hide();
        };

        /**
         * @summary Causes a record entry to be deleted.
         *
         * @param {string} id - The id of the RKS entry.
         */
        $scope.delete = function(id) {
            $http({
                method: "DELETE",
                url: session.url("/rks/:id", {
                    id: id
                }, {
                    context: $scope.context,
                    recursive: $scope.deleteRecursive
                }),
                headers: {
                    "Authorization": "Bearer " + session.token()
                }
            }).then(function() {
                var selected = $scope.storage.get('selectedRecords')[$scope.context];
                var level = selected.length - 2;
                if (level < 0) {
                    return $scope.refresh(true);
                } else {
                    var entry, entries = $scope.levels[level].entries;
                    var test = selected[level];
                    for (var i = 0; i < entries.length; ++i) {
                        if (entries[i].id === test) {
                            entry = entries[i];
                        }
                    }
                    return $scope.selectEntry(level, entry);
                }
            }).then(function() {
                $mdDialog.hide();
            }).catch(function(res) {
                if (res.data && res.data.message) {
                    $scope.selected.error = res.data.message;
                } else {
                    $scope.selected.error = "An unexpected error ocurred.";
                }
                $mdDialog.hide();
            });
        };

        /**
         * @summary Opens the modal for deleting a record entry.
         *
         * @param {object} e - The event object.
         */
        $scope.deleteModal = function(e) {
            e.stopPropagation();
            e.preventDefault();
            $scope.deleteConfirm = "";
            $scope.deleteRecursive = false;
            $mdDialog.show({
                clickOutsideToClose: true,
                scope: $scope,
                targetEvent: e,
                templateUrl: 'deleteEntry.tmpl.html',
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
         * @summary Saves the data to a file.
         *
         * @param {string} type - The type of the data (either "json" or "octet-stream").
         */
        $scope.download = function(type) {
            dialog.showSaveDialog(function(filename) {
                if (typeof filename === "undefined") {
                    return;
                }
                return resolveImmutable($scope.selected.immutable).then(function(immutable) {
                    request.get({
                        uri: session.url("/iss/immutable/:id", {
                            id: immutable.immutable
                        }, {
                            context: $scope.context
                        }),
                        headers: {
                            "Authorization": "Bearer " + session.token(),
                            "Accept": "application/" + type
                        }
                    }).on("error", function(e) {
                        $scope.error = e.message || "Unable to download to file";
                    }).pipe(fs.createWriteStream(filename));
                });
            });
        };

        /**
         * @summary Opens the modal to modify the Visualizer settings.
         *
         * @param {object} e - The event object.
         */
        $scope.editReference = function(e) {
            e.stopPropagation();
            e.preventDefault();
            $mdDialog.show({
                clickOutsideToClose: true,
                scope: $scope,
                targetEvent: e,
                templateUrl: 'entryReference.tmpl.html',
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
                    $scope.storage.set('context', $scope.context);
                    $scope.storage.set('inactive', $scope.inactive);
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
                // Add entries to level and set new next value
                level.entries = level.entries.concat(res.data);
                level.next = res.headers("Thinknode-Next");
                if (level.next) {
                    return $scope.nextPage(index);
                }
            });
        };

        /**
         * @summary Refreshes the state of the visualizer hierarchy.
         *
         * @param {boolean} force - Indicates whether the refresh operation should be forced (in the
         *   case that the user has entered in a new context, for instance).
         * @param {string[]} selected - The array of the selected entry ids.
         * @returns {Promise} An angular promise that resolves when the root-level entries have been
         *   retrieved. It will also resolve if the context is invalid and cannot be used in the
         *   query.
         */
        $scope.refresh = function(force, selected) {
            if (refreshPromise && !force) {
                return refreshPromise;
            }
            $scope.selected = null;
            $scope.focus = "hierarchy";
            $scope.levels = [];
            $scope.error = "";
            if (!$scope.context || !/^[a-zA-Z0-9]{32}$/.test($scope.context)) {
                $scope.error = "Invalid context provided.";
                return (refreshPromise = $q.resolve());
            }
            var level = {
                "parent": null,
                "next": true,
                "entries": [],
                "filter": ""
            };
            return (refreshPromise = inspectContext().then(function(info) {
                if (info.bucket !== "#ref") {
                    $scope.bucket = info.bucket;
                }
                return queryEntries();
            }).then(function(res) {
                // Add initial level
                $scope.levels = [];
                level.next = res.headers('Thinknode-Next');
                level.entries = res.data;
                $scope.levels.push(level);
                if (level.next) {
                    return $scope.nextPage($scope.levels.length - 1);
                }
            }).then(function() {
                var map;
                if (selected) {
                    var found, remembered = selected.shift();
                    for (var i = 0; i < level.entries.length; ++i) {
                        if (level.entries[i].id === remembered) {
                            found = $scope.selected = level.entries[i];
                            level.entries[i].selected = true;
                        } else {
                            level.entries[i].selected = false;
                        }
                    }
                    if (found) {
                        return $scope.selectEntry(0, found, selected);
                    }
                }
                // Otherwise, reset the selected records.
                map = $scope.storage.get('selectedRecords') || {};
                map[$scope.context] = [];
                $scope.storage.set('selectedRecords', map);
            }).catch(function(res) {
                $scope.selected = null;
                $scope.focus = "hierarchy";
                $scope.levels = [];
                if (res.data && res.data.message) {
                    $scope.error = res.data.message;
                } else {
                    $scope.error = "An unexpected error occurred.";
                }
            }));
        };

        /**
         * @summary Scrolls the heirarchy window to the last level.
         */
        $scope.rescroll = function() {
            $timeout(function() {
                var container = angular.element("#records-visualizer-hierarchy");
                var elements = angular.element(".records-level");
                container.scrollTo(elements.length * elements.width());
            }, 200);
        };

        /**
         * @summary Saves the current state of the entry.
         */
        $scope.save = function() {
            var promise = $q.resolve();
            if ($scope.selected.edit.data.body !== $scope.selected.data.body) {
                promise = promise.then(function() {
                    return $http({
                        method: "POST",
                        url: session.url("/iss/:type", {
                            type: $scope.selected.edit.data.type
                        }, {
                            context: $scope.context
                        }),
                        data: $scope.selected.edit.data.body,
                        headers: {
                            "Authorization": "Bearer " + session.token(),
                            "Content-Type": "application/json"
                        }
                    });
                }).then(function(res) {
                    $scope.selected.edit.immutable = res.data.id;
                });
            }
            return promise.then(function() {
                return $http({
                    method: "PUT",
                    url: session.url("/rks/:id", {
                        id: $scope.selected.id
                    }, {
                        context: $scope.context
                    }),
                    data: {
                        name: $scope.selected.name,
                        parent: $scope.selected.parent,
                        immutable: $scope.selected.edit.immutable,
                        active: $scope.selected.edit.active,
                        revision: $scope.selected.revision
                    },
                    headers: {
                        "Authorization": "Bearer " + session.token()
                    }
                });
            }).then(function(res) {
                var selected = $scope.storage.get('selectedRecords')[$scope.context];
                var level = selected.length - 2;
                if (level < 0) {
                    return $scope.refresh(true, selected);
                } else {
                    var entry, entries = $scope.levels[level].entries;
                    var test = selected[level];
                    for (var i = 0; i < entries.length; ++i) {
                        if (entries[i].id === test) {
                            entry = entries[i];
                        }
                    }
                    return $scope.selectEntry(level, entry, selected.slice(selected.length - 1));
                }
            }).catch(function(res) {
                if (res.data && res.data.message) {
                    $scope.selected.error = res.data.message;
                } else {
                    $scope.selected.error = "An unexpected error occurred.";
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
         * @param {object} entry - The selected entry.
         * @param {string[]} list - A list of additional entry ids to select.
         */
        $scope.selectEntry = function(level, entry, list) {
            $scope.levels = $scope.levels.slice(0, level + 1);
            var entries = $scope.levels[level].entries;
            for (var i = 0; i < entries.length; ++i) {
                entries[i].selected = (entries[i].id === entry.id);
                entries[i].edit = {
                    immutable: entries[i].immutable,
                    active: entries[i].active
                };
            }
            $scope.selected = entry;
            // Add new level
            var new_level = {
                "parent": $scope.selected.id,
                "next": true,
                "entries": [],
                "filter": ""
            };
            $scope.levels.push(new_level);
            return getObject($scope.selected.immutable).then(function(obj) {
                $scope.selected.data = obj;
                $scope.selected.edit.data = _.cloneDeep(obj);
                return queryEntries($scope.selected.id);
            }).then(function(res) {
                // Set level properties
                new_level.next = res.headers("Thinknode-Next");
                new_level.entries = res.data;
                // Scroll to new level
                var container = angular.element("#records-visualizer-hierarchy");
                var element = angular.element(".records-level:last");
                container.scrollTo(element.position().left);
                // Get next entries
                if (new_level.next) {
                    return $scope.nextPage($scope.levels.length - 1);
                }
            }).then(function() {
                var map;
                if (list) {
                    var found, remembered = list.shift();
                    for (var i = 0; i < new_level.entries.length; ++i) {
                        if (new_level.entries[i].id === remembered) {
                            found = $scope.selected = new_level.entries[i];
                            new_level.entries[i].selected = true;
                        } else {
                            new_level.entries[i].selected = false;
                        }
                    }
                    if (found) {
                        return $scope.selectEntry(level + 1, found, list);
                    } else {
                        map = $scope.storage.get('selectedRecords');
                        map[$scope.context] = map[$scope.context].slice(0, level + 1);
                        $scope.storage.set('selectedRecords', map);
                    }
                } else {
                    // Add to storage
                    map = $scope.storage.get('selectedRecords') || {};
                    var selected = map[$scope.context] = (map[$scope.context] || []).slice(0, level);
                    selected.push($scope.selected.id);
                    $scope.storage.set('selectedRecords', map);
                }
            }).catch(function(res) {
                if (res instanceof Error) {
                    $scope.selected.error = res.message;
                } else if (res.data && res.data.message) {
                    $scope.selected.error = res.data.message;
                } else {
                    $scope.selected.error = "An unexpected error occurred.";
                }
            });
        };

        /**
         * @summary Toggles whether the fullscreen view is displayed.
         *
         * @param {object} e - The event object.
         */
        $scope.toggleFullscreen = function(e) {
            e.stopPropagation();
            e.preventDefault();
            $scope.fullscreen = !$scope.fullscreen;
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
                        obj[subparts[0]] = subparts[1].toLowerCase();
                    } else {
                        strings.push(part.toLowerCase());
                    }
                } else {
                    strings.push(part.toLowerCase());
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
                if (obj.name && item.name.toLowerCase().indexOf(obj.name) < 0) {
                    failed = true;
                }
                // Check record field
                if (obj.record) {
                    temp = item.record.account + "/" + item.record.app + "/" + item.record.name;
                    if (temp.toLowerCase().indexOf(obj.record) < 0) {
                        failed = true;
                    }
                }
                // Check name against strings
                found = false;
                for (j = 0; j < strings.length; ++j) {
                    if (item.name.toLowerCase().indexOf(strings[j]) > -1) {
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
        '$timeout',
        '$mdDialog',
        recordsController
    ]).filter('entry', entryFilter);
})();