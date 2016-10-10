/*
 * Calculation Controller
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function calcController($scope, session, $http, $q, $rootScope, $window, $timeout, $mdDialog) {

        // --------------------------------------------------
        // Local requires

        var _ = require('lodash');
        var async = require('async');
        var d3 = require('d3');
        var fs = require('fs');
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        // --------------------------------------------------
        // Local variables

        var MAX_IMMUTABLE_SIZE = 5000;
        var deregisterInit;
        var refreshPromise;
        var root;
        var root_obj = {};
        var i = 0;
        var duration = 750;
        var memcache = {
            requests: {},
            raw_requests: {},
            immutables: {},
            data: {},
            statuses: {}
        };
        var appinfo = {};

        var margin = {
            top: 10,
            right: 120,
            bottom: 20,
            left: 120
        };
        var container = d3.select("#calc-visualizer-graph");
        var computedHeight = container.node().getBoundingClientRect().height;
        var computedWidth = container.node().getBoundingClientRect().width;
        var svg = d3.select("svg")
            .attr("height", computedHeight)
            .attr("width", computedWidth)
            .append("g")
            .attr("transform", "translate(" + margin.left + ",0)");

        var tree = d3.tree()
            .size([computedWidth, computedHeight]);

        var init = function() {
            deregisterInit();
            $scope.context = $scope.storage.get('context');
            $scope.id = $scope.storage.get('id');
            $scope.searchRequest = $scope.storage.get('searchRequest');
            $scope.searchResult = $scope.storage.get('searchResult');
            $scope.view = $scope.storage.get('calcView') || 'details';
            $scope.searchHistory = $scope.storage.get('searchHistory') || [];
            var selected = $scope.storage.get('selectedSearchTab');
            $scope.selectedSearchTab = (typeof selected === "number") ? selected : 0;
            $scope.refresh();
        };

        /**
         * @summary Resolves calculation references.
         * @description
         * `data` is an object containing a calculation id and the path to the calculation and
         * `callback` is a function that should be called when the worker has finished execution.
         */
        var calcReferenceQueue = async.queue(function(data, callback) {
            getRequest(data.id).then(function(req) {
                memcache.raw_requests[data.id] = req;
                $scope.loaded++;
                return getCalcReferences(req, data.paths);
            }).then(function(ids) {
                var id;
                for (var i = 0; i < ids.length; ++i) {
                    id = ids[i];
                    if (typeof memcache.raw_requests[id] === "undefined") {
                        memcache.raw_requests[id] = true;
                        calcReferenceQueue.push({
                            "id": id,
                            "paths": _.find($scope.requests, "id", id).paths
                        });
                        $scope.total++;
                    }
                }
                callback();
            });
        }, 4);

        // --------------------------------------------------
        // Local functions

        /**
         * @summary Adds the children for a node
         *
         * @param {object} obj - The node's data.
         */
        function addChildren(obj) {
            var i, key, keys, request;
            if (obj.id) {
                request = memcache.raw_requests[obj.id];
            } else {
                request = obj.request;
            }

            if (typeof request.array !== "undefined") {
                obj.type = "array";
                obj.children = [];
                for (i = 0; i < request.array.items.length; ++i) {
                    obj.children.push(constructNode(request.array.items[i], "[" + i + "]", 1));
                }
            } else if (typeof request.cast !== "undefined") {
                obj.type = "cast";
                obj.children = [];
                obj.children.push(constructNode(request.cast.object, "object", 1));
            } else if (typeof request.function !== "undefined") {
                obj.type = "function";
                obj.children = [];
                var account = request.function.account;
                var app = request.function.app;
                var name = request.function.name;
                for (i = 0; i < request.function.args.length; ++i) {
                    var arg;
                    try {
                        arg = appinfo[account][app].functions[name].schema.function_type.parameters[i].name;
                    } catch (e) {
                        arg = "arg" + i;
                    }
                    obj.children.push(constructNode(request.function.args[i], arg, 1));
                }
            } else if (typeof request.item !== "undefined") {
                obj.type = "item";
                obj.children = [];
                obj.children.push(constructNode(request.item.array, "array", 1));
                obj.children.push(constructNode(request.item.index, "index", 1));
            } else if (typeof request.meta !== "undefined") {
                obj.type = "meta";
                obj.children = [];
                obj.children.push(constructNode(request.meta.generator, "generator", 1));
            } else if (typeof request.mutate !== "undefined") {
                obj.type = "mutate";
                obj.children = [];
                obj.children.push(constructNode(request.mutate.object, "object", 1));
            } else if (typeof request.object !== "undefined") {
                obj.type = "object";
                obj.children = [];
                keys = Object.keys(request.object.properties).sort();
                for (i = 0; i < keys.length; ++i) {
                    key = keys[i];
                    obj.children.push(constructNode(request.object.properties[key], "[" + JSON.stringify(key) + "]", 1));
                }
            } else if (typeof request.property !== "undefined") {
                obj.type = "property";
                obj.children = [];
                obj.children.push(constructNode(request.property.object, "object", 1));
                obj.children.push(constructNode(request.property.field, "field", 1));
            } else if (typeof request.reference !== "undefined") {
                obj.type = "reference";
                obj.reference = request.reference;
            } else { // if (typeof request.value !== "undefined")
                obj.type = "value";
                obj.value = JSON.stringify(request.value, null, "\t");
            }
        }

        /**
         * @summary Adds an element to a list of branch pads.
         *
         * @param {number[][]} paths - An array of path lists.
         * @param {number} element - The number to add to the path.
         * @returns {number[][]} An array of path lists.
         */
        function branchPaths(paths, element) {
            paths = _.cloneDeep(paths);
            if (paths.length === 0) {
                paths.push([element]);
                return paths;
            }
            for (var i = 0; i < paths.length; ++i) {
                var path = paths[i];
                path.push(element);
            }
            return paths;
        }

        /**
         * @summary Collapses a node.
         *
         * @param {object} d - The datum object.
         */
        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        /**
         * @summary Constructs the connector path d attribute.
         *
         * @param {object} d - The datum object.
         * @returns {string} The connector path d attribute.
         */
        function connector(d) {
            return "M" + d.y + "," + d.x +
                "C" + (d.y + d.parent.y) / 2 + "," + d.x +
                " " + (d.y + d.parent.y) / 2 + "," + d.parent.x +
                " " + d.parent.y + "," + d.parent.x;
        }

        /**
         * @summary Add calculation references to the given list.
         *
         * @param {object} req - A calculation request.
         * @param {string[]} list - A list to add all calculation references to.
         * @param {number[]} paths - A list of array of indices within the children arrays of nodes
         *   that provide a path to the current node.
         */
        function collectCalcReferences(req, list, paths) {
            var i, key, keys, id, service, npath;
            if (typeof req.array !== "undefined") {
                for (i = 0; i < req.array.items.length; ++i) {
                    collectCalcReferences(req.array.items[i], list, branchPaths(paths, i));
                }
            } else if (typeof req.cast !== "undefined") {
                collectCalcReferences(req.cast.object, list, branchPaths(paths, 0));
            } else if (typeof req.function !== "undefined") {
                for (i = 0; i < req.function.args.length; ++i) {
                    collectCalcReferences(req.function.args[i], list, branchPaths(paths, i));
                }
            } else if (typeof req.item !== "undefined") {
                collectCalcReferences(req.item.array, list, branchPaths(paths, 0));
                collectCalcReferences(req.item.index, list, branchPaths(paths, 1));
            } else if (typeof req.meta !== "undefined") {
                collectCalcReferences(req.meta.generator, list, branchPaths(paths, 0));
            } else if (typeof req.mutate !== "undefined") {
                collectCalcReferences(req.mutate.object, list, branchPaths(paths, 0));
            } else if (typeof req.object !== "undefined") {
                keys = Object.keys(req.object.properties).sort();
                for (i = 0; i < keys.length; ++i) {
                    key = keys[i];
                    collectCalcReferences(req.object.properties[key], list, branchPaths(paths, i));
                }
            } else if (typeof req.property !== "undefined") {
                collectCalcReferences(req.property.object, list, branchPaths(paths, 0));
                collectCalcReferences(req.property.field, list, branchPaths(paths, 1));
            } else if (typeof req.reference !== "undefined") {
                id = req.reference;
                service = getService(id);
                if (service === "calc") {
                    if (list.indexOf(id) < 0) {
                        list.push(id);
                        $scope.requests.push({
                            "id": id,
                            "paths": paths
                        });
                    } else {
                        var request = _.find($scope.requests, "id", id);
                        request.paths = request.paths.concat(paths);
                    }
                }
            }
        }

        /**
         * @summary Constructs and returns a node.
         *
         * @param {object} definition - The request definition.
         * @param {string} parent_type - The type with respect to the parent.
         * @param {number} depth - The maximum depth at which to traverse the tree.
         * @returns {object} The newly constructed node.
         */
        function constructNode(definition, parent_type, depth) {
            var obj = {};
            var i, key, keys, request, service;

            if (typeof parent_type === "string") {
                obj.ptype = parent_type;
            }

            depth = depth || 0;
            if (typeof definition.reference === "string" &&
                getService(definition.reference) === "calc") {
                obj.id = definition.reference;
                watchStatus(obj).then(function() {
                    return getObject(obj.id);
                }).then(function(data) {
                    obj.data = data;
                    var result = _.find($scope.results, "id", obj.id);
                    if (!result) {
                        $scope.results.push({
                            "id": obj.id,
                            "data": obj.data
                        });
                    }
                });
                request = memcache.raw_requests[obj.id];
                obj.type = getType(request);
                if (depth > 0) {
                    return obj;
                }
            } else {
                request = definition;
                obj.type = getType(request);
                obj.request = request;
                if (depth > 0) {
                    return obj;
                }
            }

            if (typeof request.array !== "undefined") {
                obj.type = "array";
                obj.children = [];
                for (i = 0; i < request.array.items.length; ++i) {
                    obj.children.push(constructNode(request.array.items[i], "[" + i + "]", depth + 1));
                }
            } else if (typeof request.cast !== "undefined") {
                obj.type = "cast";
                obj.children = [];
                obj.children.push(constructNode(request.cast.object, "object", depth + 1));
            } else if (typeof request.function !== "undefined") {
                obj.type = "function";
                obj.children = [];
                var account = request.function.account;
                var app = request.function.app;
                var name = request.function.name;
                for (i = 0; i < request.function.args.length; ++i) {
                    var arg;
                    try {
                        arg = appinfo[account][app].functions[name].schema.function_type.parameters[i].name;
                    } catch (e) {
                        arg = "arg" + i;
                    }
                    obj.children.push(constructNode(request.function.args[i], arg, depth + 1));
                }
            } else if (typeof request.item !== "undefined") {
                obj.type = "item";
                obj.children = [];
                obj.children.push(constructNode(request.item.array, "array", depth + 1));
                obj.children.push(constructNode(request.item.index, "index", depth + 1));
            } else if (typeof request.meta !== "undefined") {
                obj.type = "meta";
                obj.children = [];
                obj.children.push(constructNode(request.meta.generator, "generator", depth + 1));
            } else if (typeof request.mutate !== "undefined") {
                obj.type = "mutate";
                obj.children = [];
                obj.children.push(constructNode(request.mutate.object, "object", depth + 1));
            } else if (typeof request.object !== "undefined") {
                obj.type = "object";
                obj.children = [];
                keys = Object.keys(request.object.properties).sort();
                for (i = 0; i < keys.length; ++i) {
                    key = keys[i];
                    obj.children.push(constructNode(request.object.properties[key], "[" + JSON.stringify(key) + "]", depth + 1));
                }
            } else if (typeof request.property !== "undefined") {
                obj.type = "property";
                obj.children = [];
                obj.children.push(constructNode(request.property.object, "object", depth + 1));
                obj.children.push(constructNode(request.property.field, "field", depth + 1));
            } else if (typeof request.reference !== "undefined") {
                obj.type = "reference";
                obj.reference = request.reference;
                getObject(obj.reference).then(function(data) {
                    obj.data = data;
                });
            } else { // if (typeof request.value !== "undefined")
                obj.type = "value";
                obj.value = JSON.stringify(request.value, null, "\t");
            }

            return obj;
        }

        /**
         * @summary Fetches the JSON data for an immutable id.
         *
         * @param {string} immutable - An immutable id.
         */
        function fetch(immutable) {
            var key = $scope.context + "-" + immutable + "-data";
            if (memcache[key]) {
                return memcache[key];
            } else {
                return (memcache[key] = $http({
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
                    return res.data;
                }, function(res) {
                    return $q.reject(new Error(res.data.message));
                }));
            }
        }

        /**
         * @summary Returns a list of calculation references contained in the request.
         *
         * @param {object} req - A calculation request.
         * @param {number[]} paths - A list of arrays of indices within the children arrays of nodes
         *   that provide a path to the current node.
         * @returns {string[]} list - A list of calculation references.
         */
        function getCalcReferences(req, paths) {
            var list = [];
            collectCalcReferences(req, list, paths);
            return list;
        }

        /**
         * @summary Gets the manifest associated with the given context content.
         *
         * @param {object} info - The context content object.
         * @returns {object} The manifest for the given context content.
         */
        function getManifest(info) {
            var account = info.account;
            var app = info.app;
            if (info.source.version) {
                return $http({
                    method: "GET",
                    url: session.url("/apm/apps/:account/:app/versions/:version", {
                        "account": account,
                        "app": app,
                        "version": info.source.version
                    }, {
                        "include_manifest": true
                    }),
                    headers: {
                        "Authorization": "Bearer " + session.token(),
                        "Accept": "application/json"
                    }
                }).then(function(res) {
                    return {
                        "account": account,
                        "app": app,
                        "manifest": res.data.manifest
                    };
                }).catch(function(res) {
                    return null;
                });
            } else if (info.source.branch) {
                return $http({
                    method: "GET",
                    url: session.url("/apm/apps/:account/:app/branches/:branch", {
                        "account": account,
                        "app": app,
                        "branch": info.source.branch
                    }, {
                        "include_manifest": true
                    }),
                    headers: {
                        "Authorization": "Bearer " + session.token(),
                        "Accept": "application/json"
                    }
                }).then(function(res) {
                    return {
                        "account": account,
                        "app": app,
                        "manifest": res.data.manifest
                    };
                }).catch(function(res) {
                    return null;
                });
            } else {
                return $q.resolve(null);
            }
        }

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
         * @summary Gets the resolved request.
         *
         * @returns {object} The resolved request.
         */
        function getRequest(id) {
            var key = $scope.context + "-" + id;
            if (typeof memcache.requests[key] !== "undefined") {
                return $q.resolve(memcache.requests[key]);
            } else {
                return (memcache.requests[key] = $http({
                    method: "GET",
                    url: session.url("/calc/:id/resolved", {
                        "id": id
                    }, {
                        "context": $scope.context
                    }),
                    headers: {
                        "Authorization": "Bearer " + session.token(),
                        "Accept": "application/json"
                    }
                }).then(function(res) {
                    return res.data;
                }));
            }
        }

        /**
         * @summary Gets the name of the service.
         *
         * @param {string} id - The Thinknode id for which to decode the service.
         * @returns {string} The name of the service.
         */
        function getService(id) {
            var buffer, type;
            try {
                buffer = new Buffer(id, 'hex');
                type = (buffer.readUInt16BE(4) & 0x0ff0) >>> 6;
            } catch (e) {
                return 'unknown';
            }
            switch (type) {
                case 1:
                    return 'iam';
                case 2:
                    return 'apm';
                case 3:
                    return 'iss';
                case 4:
                    return 'calc';
                case 5:
                    return 'cas';
                case 6:
                    return 'rks';
                case 7:
                    return 'immutable';
                default:
                    return 'unknown';
            }
        }

        /**
         * @summary Gets the calculation status for the given id.
         *
         * @param {string} id - The id of a calculation.
         * @param {object} params - The parameters of the http request.
         * @returns {object} The status.
         */
        function getStatus(id, params) {
            var key = $scope.context + "-" + id;
            if (typeof memcache.statuses[key] !== "undefined") {
                return memcache.statuses[key];
            } else {
                return (memcache.statuses[key] = $http(params).then(function(res) {
                    delete memcache.statuses[key];
                    return res;
                }));
            }
        }

        /**
         * @summary Get the type of the given request.
         *
         * @param {object} request - The calculation request.
         * @returns {string} The request type.
         */
        function getType(request) {
            for (var type in request) {
                return type;
            }
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
         * @summary Computes a space-delimited list of classes for the given node.
         *
         * @param {object} d - The node to set the classes on.
         * @returns {string} A space-delimited list of classes.
         */
        function nodeClass(d) {
            var cls = "node";
            if (d._children) {
                cls += " full";
            } else if (d.children) {
                cls += " empty";
            } else if (d.data.type !== "value" && d.data.type !== "reference") {
                cls += " full";
            } else {
                cls += " empty";
            }
            if (d.data.type !== "value" && d.data.type !== "reference" && d.data.status) {
                cls += " " + d.data.status.type;
            }
            if (d.selected) {
                cls += " selected";
            }
            if (d.highlight) {
                cls += " highlight";
            }
            return cls;
        }

        /**
         * @summary Computes the text label for the given node.
         *
         * @param {object} d - The node to be labelled.
         * @returns {string} A string that labels the node.
         */
        function nodeText(d) {
            var data, fcn, label = "";
            data = d.data;
            // If leaf node, label with respect to parent, then "self"
            if (data.type === "reference" || data.type === "value") {
                data = d.data;
                label += data.ptype + " > ";
                if (data.type === "function") {
                    fcn = memcache.raw_requests[data.id].function;
                    label += fcn.account + "/" + fcn.app + "/" + fcn.name + "()";
                } else if (data.type === "reference") {
                    label += "{}";
                } else {
                    label += data.type;
                }
            } else if (d.children) {
                // If open, label with respect to "self"
                if (data.type === "function") {
                    fcn = memcache.raw_requests[data.id].function;
                    label += fcn.account + "/" + fcn.app + "/" + fcn.name + "()";
                } else if (data.type === "reference") {
                    label += "{}";
                } else {
                    label += data.type;
                }
            } else {
                // If closed, label with respect to parent
                label = d.data.ptype;
            }
            if (data.status && data.status.type === "calculating") {
                label += " (" + (data.status.data.calculating.progress * 100).toFixed(2) + "%)";
            }
            return label;
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
            if (typeof memcache.data[key] !== "undefined") {
                return $q.resolve(memcache.data[key]);
            } else {
                return (memcache.data[key] = $http({
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
                    return {
                        "immutable": immutable,
                        "size": parseInt(res.headers("Thinknode-Size"))
                    };
                }));
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
            if (typeof memcache.immutables[key] !== "undefined") {
                return memcache.immutables[key];
            } else {
                var data = {};
                return (memcache.immutables[key] = $http({
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
                        data.immutable = res.data.id;
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
                    data.type = res.headers("Thinknode-Type");
                    return data;
                }));
            }
        }

        /**
         * @summary Highlights matching nodes and opens it's ancestors.
         *
         * @param {object} node - A d3 node.
         * @param {integer[]} path - A path to a calculation to reveal (highlight).
         */
        function reveal(node, path) {
            var index;
            if (path.length === 0) {
                node.highlight = true;
            } else if (node.children) {
                index = path.shift();
                reveal(node.children[index], path);
            } else if (node._children) {
                index = path.shift();
                reveal(node._children[index], path);
                toggle(node);
            } else {
                toggle(node);
                reveal(node, path);
            }
        }

        /**
         * @summary Toggles the node open or closed.
         *
         * @param {object} d - The node to toggle.
         */
        function toggle(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
                d.data.closed = true;
            } else if (d._children) {
                d.children = d._children;
                d._children = null;
                d.data.closed = false;
            } else if (d.data.type !== "value" && d.data.type !== "reference") {
                addChildren(d.data);
                root = d3.hierarchy(root_obj);
                root.each(function(d) {
                    if (d.data.closed && d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else if (d.data.open && d._children) {
                        d.children = d._children;
                        d._children = null;
                    }
                    if (!d.id) {
                        d.id = ++i;
                    }
                });
            }
            update(d);
            svg.selectAll("g.node text").text(nodeText);
        }

        /**
         * @summary Updates the tree d3 element.
         * @description
         * Taken in part from
         * http://stackoverflow.com/questions/38310768/d3-js-v4-wacky-link-transition-in-collapsible-tree-example
         */
        function update(source) {
            var maxDepth = 0;
            var maxX = 0;

            // Compute maximum depth
            tree(root).descendants().forEach(function(d) {
                if (d.depth > maxDepth) {
                    maxDepth = d.depth;
                }
            });

            // Update height and width
            var computedHeight = container.node().getBoundingClientRect().height;
            var computedWidth = container.node().getBoundingClientRect().width;
            computedWidth = Math.max(computedWidth, 240 + maxDepth * 180);
            if (typeof source.x0 === "undefined" || typeof source.y0 === "undefined") {
                source.x0 = computedHeight / 2;
                source.y0 = 0;
            }
            d3.selectAll("svg").attr("height", computedHeight).attr("width", computedWidth);
            tree.size([computedWidth, computedHeight]);

            // Compute maximum x.
            tree(root).descendants().forEach(function(d) {
                if (d.x > maxX) {
                    maxX = d.x;
                }
            });

            // Compute the new tree layout
            var nodes = tree(root).descendants();
            var links = nodes.slice(1);

            // Normalize y for fixed-depth.
            // Normalize x against contant height.
            nodes.forEach(function(d) {
                d.y = d.depth * 180;
                d.x = (d.x / maxX) * (computedHeight - margin.top - margin.bottom);
            });

            // Update the nodes...
            var node = svg.selectAll("g.node")
                .data(nodes, function(d) {
                    return d.id || (d.id = ++i);
                });

            // Enter any new nodes at the parent's previous position
            var nodeEnter = node.enter().append("g")
                .attr("class", nodeClass)
                .attr("transform", function(d) {
                    return "translate(" + source.y0 + "," + source.x0 + ")";
                })
                .on("click", function(d) {
                    if (d3.event.altKey) {
                        toggle(d);
                    } else {
                        var nodes = svg.selectAll("g.node");
                        // Set selected field to false for all nodes
                        nodes.each(function(d) {
                            d.selected = false;
                        });
                        // Set selected field to true for selected node
                        d.selected = true;
                        nodes.attr("class", nodeClass);
                        // Put selection into scope variable
                        $scope.selected = d.data;
                        var str = JSON.stringify(memcache.raw_requests[d.data.id], null, "\t");
                        $scope.selected.request = str;
                        $scope.$apply();
                    }
                }).on("contextmenu", function(d) {
                    toggle(d);
                });

            nodeEnter.append("circle")
                .attr("class", "main")
                .attr("r", "1e-6");

            nodeEnter.append("circle")
                .attr("class", "highlight")
                .attr("r", "1e-6")
                .style("fill-opacity", 0)
                .style("stroke", "rgba(0, 0, 0, 0)");

            nodeEnter.append("text")
                .attr("x", function(d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("dy", ".35em")
                .attr("text-anchor", function(d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(nodeText)
                .style("fill-opacity", 1e-6);

            // Transition nodes to their new position.
            var nodeUpdate = node.merge(nodeEnter).transition()
                .duration(duration)
                .attr("class", nodeClass)
                .attr("transform", function(d) {
                    return "translate(" + d.y + "," + d.x + ")";
                });

            nodeUpdate.select("circle.main")
                .attr("r", 4.5);

            nodeUpdate.select("circle.highlight")
                .attr("r", 9)
                .style("fill-opacity", 0)
                .style("stroke", function(d) {
                    if (d.highlight) {
                        return "rgba(126, 129, 129, 0.5";
                    } else {
                        return "rgba(0, 0, 0, 0)";
                    }
                })
                .style("stroke-width", function(d) {
                    if (d.highlight) {
                        return "8px";
                    } else {
                        return "0px";
                    }
                });

            nodeUpdate.select("text")
                .style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function(d) {
                    return "translate(" + source.y + "," + source.x + ")";
                })
                .remove();

            nodeExit.each(function(d) {
                if (d.data === $scope.selected) {
                    $scope.selected = null;
                    $scope.$apply();
                }
                d.selected = false;
            });

            nodeExit.select("circle.main")
                .attr("r", 1e-6);

            nodeExit.select("circle.highlight")
                .attr("r", 1e-6);

            nodeExit.select("text")
                .style("fill-opacity", 1e-6);


            // Update the links...
            var link = svg.selectAll("path.link")
                .data(links, function(link) {
                    var id = link.id + '->' + link.parent.id;
                    return id;
                });

            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr("d", connector);

            // Enter any new links at the parent's previous position.
            var linkEnter = link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", function(d) {
                    var o = {
                        x: source.x0,
                        y: source.y0,
                        parent: {
                            x: source.x0,
                            y: source.y0
                        }
                    };
                    return connector(o);
                });

            // Transition links to their new position.
            link.merge(linkEnter).transition()
                .duration(duration)
                .attr("d", connector);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
                .duration(duration)
                .attr("d", function(d) {
                    var o = {
                        x: source.x,
                        y: source.y,
                        parent: {
                            x: source.x,
                            y: source.y
                        }
                    };
                    return connector(o);
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(function(d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        /**
         * @summary Updates the status of a calculation by long polling.
         *
         * @param {object} obj - The object for which to update the status.
         */
        function watchStatus(obj) {
            var id = obj.id;
            var params = {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + session.token(),
                    "Accept": "application/json"
                }
            };
            if (!obj.status) {
                params.url = session.url("/calc/:id/status", {
                    "id": id
                }, {
                    "context": $scope.context,
                    "status": "queued",
                    "queued": "pending",
                    "timeout": 180
                });
            } else if (obj.status.type === "pending") {
                params.url = session.url("/calc/:id/status", {
                    "id": id
                }, {
                    "context": $scope.context,
                    "status": "queued",
                    "queued": "ready",
                    "timeout": 180
                });
            } else if (obj.status.type === "ready") {
                params.url = session.url("/calc/:id/status", {
                    "id": id
                }, {
                    "context": $scope.context,
                    "status": "calculating",
                    "progress": 0,
                    "timeout": 180
                });
            } else if (obj.status.type === "calculating") {
                var progress = obj.status.data.calculating.progress + 0.01;
                if (progress >= 1) {
                    params.url = session.url("/calc/:id/status", {
                        "id": id
                    }, {
                        "context": $scope.context,
                        "status": "uploading",
                        "progress": 0,
                        "timeout": 180
                    });
                } else {
                    params.url = session.url("/calc/:id/status", {
                        "id": id
                    }, {
                        "context": $scope.context,
                        "status": "calculating",
                        "progress": progress,
                        "timeout": 180
                    });
                }
            } else if (obj.status.type === "uploading") {
                params.url = session.url("/calc/:id/status", {
                    "id": id
                }, {
                    "context": $scope.context,
                    "status": "completed",
                    "timeout": 180
                });
            } else { // if (obj.status.type === "completed" || obj.status.type === "failed")
                params.url = session.url("/calc/:id/status", {
                    "id": id
                }, {
                    "context": $scope.context,
                    "status": "queued",
                    "queued": "pending",
                    "timeout": 180
                });
            }
            return getStatus(id, params).then(function(res) {
                var data = res.data;
                if (!obj.status) {
                    obj.status = {};
                }
                obj.status.data = data;
                obj.status.body = JSON.stringify(data, null, "\t");
                if (data.queued === "pending") {
                    obj.status.type = "pending";
                    return true;
                } else if (data.queued === "ready") {
                    obj.status.type = "ready";
                    return true;
                } else if (typeof data.calculating !== "undefined") {
                    obj.status.type = "calculating";
                    return true;
                } else if (typeof data.uploading !== "undefined") {
                    obj.status.type = "uploading";
                    return true;
                } else if (typeof data.completed !== "undefined") {
                    obj.status.type = "completed";
                    return false;
                } else if (typeof data.failed !== "undefined") {
                    obj.status.type = "failed";
                    return false;
                }
            }).then(function(retry) {
                // Update classes
                svg.selectAll("g.node").attr("class", nodeClass);
                // Update labels
                svg.selectAll("g.node text").text(nodeText);
                if (retry) {
                    return watchStatus(obj);
                }
            });
        }

        // --------------------------------------------------
        // Scope variables

        $scope.context = null;
        $scope.id = null;
        $scope.bucket = null;
        $scope.selected = null;
        $scope.loading = false;
        $scope.view = 'details';
        $scope.requests = [];
        $scope.results = [];
        $scope.loaded = 0;
        $scope.total = 0;
        $scope.max_immutable_size = MAX_IMMUTABLE_SIZE;

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
         * @summary Closes the settings modal.
         */
        $scope.close = function() {
            $mdDialog.hide();
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
                return resolveImmutable($scope.selected.id).then(function(immutable) {
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
         * @summary Saves the request to a file.
         */
        $scope.downloadRequest = function() {
            dialog.showSaveDialog(function(filename) {
                if (typeof filename === "undefined") {
                    return;
                }
                return getRequest($scope.selected.id).then(function(req) {
                    fs.writeFileSync(filename, JSON.stringify(req));
                });
            });
        };

        /**
         * @summary Fetches the JSON data for a selected node.
         */
        $scope.fetchData = function() {
            $scope.fetching = true;
            return fetch($scope.selected.data.immutable).then(function(body) {
                $scope.selected.data.body = JSON.stringify(body, null, "\t");
                $scope.fetching = false;
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
                templateUrl: 'calcSettings.tmpl.html',
                preserveScope: true,
                onShowing: function() {
                    $scope.open = true;
                },
                onRemoving: function() {
                    $scope.open = false;
                    $scope.storage.set('context', $scope.context);
                }
            });
        };

        /**
         * @summary Refreshes the state of the visualizer hierarchy.
         *
         * @param {boolean} force - Indicates whether the refresh operation should be forced (in the
         *   case that the user has entered in a new context, for instance).
         * @returns {Promise} An angular promise that resolves when the root level calculation has
         *   been retrieved. It will also resolve if the context is invalid and cannot be used in
         *   the query.
         */
        $scope.refresh = function(force) {
            // Returned the current promise if already resolved (unless forced).
            if (refreshPromise && !force) {
                return refreshPromise;
            }
            $scope.selected = null;
            $scope.error = "";
            if (!$scope.context || !/^[a-zA-Z0-9]{32}$/.test($scope.context)) {
                $scope.error = "Invalid context provided.";
                return (refreshPromise = $q.resolve());
            }
            if (!$scope.id || !/^[a-zA-Z0-9]{32}$/.test($scope.id)) {
                $scope.error = "Invalid id provided.";
                return (refreshPromise = $q.resolve());
            }
            var service = getService($scope.id);
            if (service !== "calc") {
                $scope.error = "Invalid id provided.";
                return (refreshPromise = $q.resolve());
            }
            $scope.storage.set('id', $scope.id);
            $scope.requests.length = 0;
            $scope.results.length = 0;
            $scope.loaded = 0;
            $scope.total = 0;
            $scope.loading = true;
            appinfo = {};
            // Return if the context or id is invalid.
            return (refreshPromise = inspectContext().then(function(info) {
                if (info.bucket !== "#ref") {
                    $scope.bucket = info.bucket;
                }
                var contents = [];
                for (var i = 0; i < info.contents.length; ++i) {
                    contents.push(getManifest(info.contents[i]));
                }
                return $q.all(contents);
            }).then(function(data) {
                var datum, fn;
                for (var i = 0; i < data.length; ++i) {
                    datum = data[i];
                    if (!appinfo[datum.account]) {
                        appinfo[datum.account] = {};
                    }
                    if (!appinfo[datum.account][datum.app]) {
                        appinfo[datum.account][datum.app] = {
                            "functions": []
                        };
                    }
                    for (var j = 0; j < datum.manifest.functions.length; ++j) {
                        fn = datum.manifest.functions[j];
                        appinfo[datum.account][datum.app].functions[fn.name] = fn;
                    }
                }
                var deferred = $q.defer();
                calcReferenceQueue.drain = deferred.resolve;
                calcReferenceQueue.push({
                    "id": $scope.id,
                    "paths": []
                });
                $scope.total++;
                return deferred.promise;
            }).then(function() {
                var req;
                for (var i = 0; i < $scope.requests.length; ++i) {
                    req = $scope.requests[i];
                    req.filterText = JSON.stringify(memcache.raw_requests[req.id]).toLowerCase();
                }
                root_obj = constructNode({
                    "reference": $scope.id
                });
                root = d3.hierarchy(root_obj);
                root.each(function(d) {
                    d.id = ++i;
                });
                root.children.forEach(collapse);
                $scope.loading = false;
                update(root);
            }).then(function() {
                $timeout(function() {
                    svg.selectAll("g.node").attr("class", nodeClass);
                }, 1000);
            }).catch(function(res) {
                $scope.selected = null;
                $scope.view = 'details';
                if (res.data && res.data.message) {
                    $scope.error = res.data.message;
                } else {
                    $scope.error = "An unexpected error occurred.";
                }
            }));
        };

        /**
         * @summary Inspects the calculation given its id.
         *
         * @param {string} id - The id of the calculation.
         */
        $scope.inspect = function(id) {
            $scope.searchHistory.push($scope.id);
            $scope.storage.set('searchHistory', $scope.searchHistory);
            $scope.id = id;
            $scope.storage.set('id', $scope.id);
            $scope.refresh(true);
        };

        /**
         * @summary Highlights the nodes matching the calculation given by its id.
         *
         * @param {number[]} path - The path to the calculation.
         */
        $scope.reveal = function(path) {
            path = _.cloneDeep(path);
            root.each(function(d) {
                d.highlight = false;
            });
            reveal(root, path);
            update(root);
        };

        /**
         * @summary Allows the right sidebar to be toggleable between details and search views.
         *
         * @param {string} view - The name of the view. Either 'details' or 'search'.
         */
        $scope.show = function(view) {
            $scope.view = view;
            $scope.storage.set("calcView", view);
        };

        /**
         * @summary Switches to the previously selected id.
         */
        $scope.undo = function() {
            $scope.id = $scope.searchHistory.pop();
            $scope.storage.set('id', $scope.id);
            $scope.storage.set('searchHistory', $scope.searchHistory);
            $scope.refresh(true);
        };

        // --------------------------------------------------
        // Resize event

        angular.element($window).bind('resize', function() {

            // Update svg
            update(root);
        });

        // --------------------------------------------------
        // Initialization

        deregisterInit = $rootScope.$on('initialized', init);

    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Filters

    function requestFilter() {
        return function(input, filter) {
            if (typeof filter !== "string" || filter.length < 3) {
                return [];
            }
            filter = filter.toLowerCase();
            var out = [];
            angular.forEach(input, function(item) {
                if (item.filterText) {
                    var str = item.filterText;
                    if (str.indexOf(filter) > -1) {
                        out.push(item);
                    }
                }
            });
            return out;
        };
    }

    function parseFilter(filter) {
        var filterObj = {};

        // Separate space delimited parts
        var parts = filter.split(" ");

        // For each part determine parameter type
        var part, num;
        for (var i = 0; i < parts.length; ++i) {
            part = parts[i];
            if (part.indexOf("type:") === 0) {
                filterObj.type = part.substring(5);
            }
            if (part.indexOf("size:>") === 0) {
                num = Number.parseInt(part.substring(6));
                if (!Number.isNaN(num)) {
                    filterObj.lower = num;
                }
            }
            if (part.indexOf("size:<") === 0) {
                num = Number.parseInt(part.substring(6));
                if (!Number.isNaN(num)) {
                    filterObj.upper = num;
                }
            }
        }

        return filterObj;
    }

    function resultFilter() {
        return function(input, filter) {
            if (typeof filter !== "string" || filter === "") {
                return [];
            }
            var parsed = parseFilter(filter.toLowerCase());
            if (Object.keys(parsed).length === 0) {
                return [];
            }
            var out = [];
            angular.forEach(input, function(item) {
                if (!item.data.type || !item.data.size) {
                    return;
                }
                if (typeof parsed.type === "string" && item.data.type.indexOf(parsed.type) < 0) {
                    return;
                }
                if (typeof parsed.lower === "number" && item.data.size <= parsed.lower) {
                    return;
                }
                if (typeof parsed.upper === "number" && item.data.size >= parsed.upper) {
                    return;
                }
                out.push(item);
            });
            return out;
        };
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register controller

    angular.module('app').controller('calcController', [
        '$scope',
        'session',
        '$http',
        '$q',
        '$rootScope',
        '$window',
        '$timeout',
        '$mdDialog',
        calcController
    ]).filter('request', requestFilter).filter('result', resultFilter);
})();