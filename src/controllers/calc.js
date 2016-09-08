/*
 * Calculation Controller
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Controller

    function calcController($scope, session, $http, $q, $rootScope, $window, $mdDialog) {

        // --------------------------------------------------
        // Local variables

        var deregisterInit;
        var refreshPromise;
        var root;
        var root_obj = {};
        var i = 0;
        var duration = 750;
        var memcache = {};

        var margin = {
            top: 20,
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
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var tree = d3.tree()
            .size([computedHeight, computedWidth]);

        // --------------------------------------------------
        // Local requires

        var fs = require('fs');
        var request = require('request');
        var remote = require('remote');
        var dialog = remote.require('dialog');

        var init = function() {
            deregisterInit();
            $scope.context = $scope.storage.get('context');
            $scope.id = $scope.storage.get('id');
            $scope.refresh();
        };

        // --------------------------------------------------
        // Local functions

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
            var key = $scope.context + "-" + id + "-request";
            if (typeof memcache[key] !== "undefined") {
                return $q.resolve(memcache[key]);
            } else {
                return $http({
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
                    memcache[key] = res.data;
                    return memcache[key];
                });
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
            cls += d._children ? " full" : " empty";
            if (d.data.type !== "value" && d.data.type !== "posted" && d.data.status) {
                cls += " " + d.data.status.type;
            }
            if (d.selected) {
                cls += " selected";
            }
            return cls;
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

        /**
         * @summary Spawns a node based on the given data.
         *
         * @param {object} data - The data to use to contruct the node.
         * @param {object} obj - The node info object.
         */
        function spawn(data, obj) {
            if (typeof data.reference !== "undefined") {
                var service = getService(data.reference);
                if (service === "calc") {
                    return getRequest(data.reference).then(function(request) {
                        var collection = [];
                        // Add common properties
                        obj.id = data.reference;
                        obj.request = JSON.stringify(request, null, 4);
                        obj.children = [];

                        // Add children based on type
                        var i, new_data;
                        if (typeof request.array !== "undefined") {
                            obj.type = "array";
                            for (i = 0; i < request.array.items.length; ++i) {
                                new_data = {
                                    ptype: "[" + i + "]"
                                };
                                collection.push(spawn(request.array.items[i], new_data));
                                obj.children.push(new_data);
                            }
                        } else if (typeof request.cast !== "undefined") {
                            obj.type = "cast";
                            new_data = {
                                ptype: "object"
                            };
                            collection.push(spawn(request.cast.object, new_data));
                            obj.children.push(new_data);
                        } else if (typeof request.function !== "undefined") {
                            obj.type = "function";
                            for (i = 0; i < request.function.args.length; ++i) {
                                new_data = {
                                    ptype: "arg" + i
                                };
                                collection.push(spawn(request.function.args[i], new_data));
                                obj.children.push(new_data);
                            }
                        } else if (typeof request.item !== "undefined") {
                            obj.type = "item";
                            new_data = {
                                ptype: "array"
                            };
                            collection.push(spawn(request.item.array, new_data));
                            obj.children.push(new_data);
                            new_data = {
                                ptype: "index"
                            };
                            collection.push(spawn(request.item.index, new_data));
                            obj.children.push(new_data);
                        } else if (typeof request.meta !== "undefined") {
                            obj.type = "meta";
                            new_data = {
                                ptype: "generator"
                            };
                            collection.push(spawn(request.meta.generator, new_data));
                            obj.children.push(new_data);
                        } else if (typeof request.mutate !== "undefined") {
                            obj.type = "mutate";
                            new_data = {
                                ptype: "object"
                            };
                            collection.push(spawn(request.mutate.object, new_data));
                            obj.children.push(new_data);
                        } else if (typeof request.object !== "undefined") {
                            obj.type = "object";
                            for (i in request.object.properties) {
                                new_data = {
                                    ptype: "[" + JSON.stringify(i) + "]"
                                };
                                collection.push(spawn(request.object.properties[i], new_data));
                                obj.children.push(new_data);
                            }
                        } else if (typeof request.property !== "undefined") {
                            obj.type = "property";
                            new_data = {
                                ptype: "object"
                            };
                            collection.push(spawn(request.property.object, new_data));
                            obj.children.push(new_data);
                            new_data = {
                                ptype: "field"
                            };
                            collection.push(spawn(request.property.field, new_data));
                            obj.children.push(new_data);
                        }
                        return $q.all(collection);
                    }).then(function() {
                        watchStatus(data.reference, obj).then(function() {
                            if (obj.status.type === "completed") {
                                return getObject(data.reference).then(function(data) {
                                    obj.data = data;
                                });
                            }
                        });
                    });
                } else if (service === "iss") {
                    obj.type = "posted";
                    obj.id = data.reference;
                    return getObject(data.reference).then(function(data) {
                        obj.data = data;
                    });
                } else {
                    $scope.error = "Invalid id: " + data.reference;
                    throw new Error("Invalid id: " + data.reference);
                }
            } else if (typeof data.value !== "undefined") {
                obj.type = "value";
                obj.value = JSON.stringify(data.value);
                return $q.resolve();
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
            } else {
                d.children = d._children;
                d._children = null;
            }
            update(d);
        }

        /**
         * @summary Updates the tree d3 element.
         * @description
         * Taken in part from
         * http://stackoverflow.com/questions/38310768/d3-js-v4-wacky-link-transition-in-collapsible-tree-example
         */
        function update(source) {
            var maxDepth = 0;

            // Compute the new tree layout
            var nodes = tree(root).descendants();
            var links = nodes.slice(1);

            // Normalize for fixed-depth.
            nodes.forEach(function(d) {
                if (d.depth > maxDepth) {
                    maxDepth = d.depth;
                }
                d.y = d.depth * 180;
            });

            // Update height and width
            var computedHeight = container.node().getBoundingClientRect().height;
            var computedWidth = container.node().getBoundingClientRect().width;
            computedWidth = Math.max(computedWidth, maxDepth * 180);
            d3.selectAll("svg").attr("height", computedHeight).attr("width", computedWidth);
            tree.size([computedHeight, computedWidth]);

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
                        $scope.$apply();
                    }
                });

            nodeEnter.append("circle")
                .attr("r", "1e-6");

            nodeEnter.append("text")
                .attr("x", function(d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("dy", ".35em")
                .attr("text-anchor", function(d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(function(d) {
                    var data, label = "";
                    // Label with respect to parent.
                    if (d.parent) {
                        data = d.parent.data;
                        if (data.type === "function") {
                            label += "f(x):";
                        } else if (data.type === "posted") {
                            label += "{}";
                        } else {
                            label += data.type;
                        }
                        data = d.data;
                        label += data.ptype + " > ";
                    }
                    // Label with respect to self
                    data = d.data;
                    if (data.type === "function") {
                        label += "f(x)";
                    } else if (data.type === "posted") {
                        label += "{}";
                    } else {
                        label += data.type;
                    }
                    return label;
                })
                .style("fill-opacity", 1e-6);

            // Transition nodes to their new position.
            var nodeUpdate = node.merge(nodeEnter).transition()
                .duration(duration)
                .attr("class", nodeClass)
                .attr("transform", function(d) {
                    return "translate(" + d.y + "," + d.x + ")";
                });

            nodeUpdate.select("circle")
                .attr("r", 4.5);

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

            nodeExit.select("circle")
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
         * @param {string} id - The id of the calculation.
         * @param {object} obj - The object for which to update the status.
         */
        function watchStatus(id, obj) {
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
                progress = obj.status.body.calculating.progress + 0.01;
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
            }
            return $http(params).then(function(res) {
                var data = res.data;
                if (!obj.status) {
                    obj.status = {};
                }
                obj.status.body = JSON.stringify(data, null, 4);
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
                if (retry) {
                    return watchStatus(id, obj);
                }
            });
        }

        // --------------------------------------------------
        // Scope variables

        $scope.context = null;
        $scope.id = null;
        $scope.bucket = null;
        $scope.selected = null;

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
            $scope.storage.set('id', $scope.id);
            // Return if the context or id is invalid.
            return (refreshPromise = inspectContext().then(function(info) {
                if (info.bucket !== "#ref") {
                    $scope.bucket = info.bucket;
                }
                return spawn({
                    "reference": $scope.id
                }, root_obj);
            }).then(function() {
                root = d3.hierarchy(root_obj);
                root.each(function(d) {
                    d.id = ++i;
                });
                root.children.forEach(collapse);
                root.x0 = computedHeight / 2;
                root.y0 = 0;
                update(root);
            }));
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
    // Register controller

    angular.module('app').controller('calcController', [
        '$scope',
        'session',
        '$http',
        '$q',
        '$rootScope',
        '$window',
        '$mdDialog',
        calcController
    ]);
})();