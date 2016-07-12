/*
 * Proxy Service
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

// .addColumn('uuid', lf.Type.STRING)
// .addColumn('target', lf.Type.STRING)
// .addColumn('type', lf.Type.STRING)
// .addColumn('hash', lf.Type.STRING)
// .addColumn('request', lf.Type.OBJECT)
// .addColumn('status', lf.Type.STRING)
// .addColumn('result', lf.Type.STRING)
// .addPrimaryKey(['uuid'])
// .addUnique('unique_hash', ['hash']);

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Service

    function proxyService(environment, session, $manifest, $rootScope, $http, $logger, Supervisor) {
        /* jshint validthis: true */

        var service = this;

        // --------------------------------------------------
        // Constants

        var ure = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        var SERIAL = {
            concurrency: 1
        };

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');
        var crypto = require('crypto');
        var express = require('express');
        var expressBodyParser = require('body-parser');
        var fs = bluebird.promisifyAll(require('fs'));
        var fspath = require('path');
        var http = require('http');
        var httpProxy = require('http-proxy');
        var net = require('net');
        var stringify = require('stabilize');
        var uuid = require('node-uuid');

        // --------------------------------------------------
        // Http Server

        var app = express();
        var proxy = httpProxy.createProxyServer({
            xfwd: true,
            changeOrigin: true
        });
        var parser = expressBodyParser.json();

        var server = http.createServer(app);
        var connections = {};

        server.on('connection', function(conn) {
            var key = conn.remoteAddress + ':' + conn.remotePort;
            connections[key] = conn;
            conn.on('close', function() {
                delete connections[key];
            });
        });

        server.forceClose = function(cb) {
            server.close(cb);
            for (var key in connections) {
                connections[key].destroy();
            }
        };

        var ctx = {
            'context': server
        };
        var listen = bluebird.promisify(server.listen, ctx);
        var close = bluebird.promisify(server.forceClose, ctx);

        // --------------------------------------------------
        // Routes

        function forward(req, res, next) {
            if (req.originalUrl.indexOf('/v1.0') === 0) {
                req.url = req.originalUrl.substr(5);
            } else {
                req.url = req.originalUrl;
            }
            proxy.web(req, res, {
                target: service.info.target
            });
        }

        app.post('/v1.0/calc', function(req, res, next) {
            parser(req, res, function(err) {
                if (err) {
                    next(err);
                } else {
                    $logger.append('debug', 'Processing calculation');
                    return process({
                        "request": req.body
                    }).then(function(item) {
                        var message = 'Finished processing calculation with id: ' + item.reference;
                        $logger.append('debug', message);
                        res.json({
                            "id": item.reference
                        });
                    }).then(function() {
                        exec();
                    }).catch(next);
                }
            });
        });

        app.get('/v1.0/calc/:id', function(req, res, next) {
            if (ure.test(req.params.id)) {
                bluebird.resolve().then(function() {
                    var filter = calculations.uuid.eq(req.params.id);
                    return environment.db()
                        .select(calculations.request)
                        .from(calculations)
                        .where(filter)
                        .exec();
                }).then(function(rows) {
                    if (rows.length !== 1) {
                        res.status(404).end();
                    } else if (rows[0].request === null) {
                        res.status(202).end();
                    } else {
                        res.json(rows[0].request);
                    }
                });
            } else {
                forward(req, res, next);
            }
        });

        app.get('/v1.0/calc/:id/status', function(req, res, next) {
            if (ure.test(req.params.id)) {
                bluebird.resolve().then(function() {
                    var filter = calculations.uuid.eq(req.params.id);
                    return environment.db()
                        .select(calculations.status)
                        .from(calculations)
                        .where(filter)
                        .exec();
                }).then(function(rows) {
                    if (rows.length !== 1) {
                        res.status(404).end();
                    } else if (rows[0].status === 'completed') {
                        res.json({
                            "completed": null
                        });
                    } else if (rows[0].status === 'failed') {
                        res.json({
                            "failed": null
                        });
                    } else {
                        res.json({
                            "pending": null
                        });
                    }
                });
            } else {
                forward(req, res, next);
            }
        });

        app.get('/v1.0/iss/:id', function(req, res, next) {
            if (ure.test(req.params.id)) {
                bluebird.resolve().then(function() {
                    var filter = calculations.uuid.eq(req.params.id);
                    return environment.db()
                        .select(calculations.id)
                        .from(calculations)
                        .where(filter)
                        .exec();
                }).then(function(rows) {
                    if (rows.length !== 1) {
                        res.status(404).end();
                    } else if (rows[0].id === null) {
                        res.status(202).end();
                    } else {
                        req.originalUrl = req.originalUrl.replace(req.params.id, rows[0].id);
                        forward(req, res, next);
                    }
                });
            } else {
                forward(req, res, next);
            }
        });

        app.all('*', forward);

        // --------------------------------------------------
        // Tcp Server

        var supervisor = new Supervisor();

        supervisor.on('notification', function(data) {
            if (data.type === "state") {
                service.info.state = data.message;
                service.info.callback();
            } else if (data.type === "close") {
                if (backlog.length === 0) {
                    service.info.state = "waiting";
                    service.info.callback();
                } else {
                    service.info.state = "staged";
                    service.info.callback();
                }
            } else {
                $logger.append(data.type, data.message);
                $rootScope.$apply();
            }
        });


        // --------------------------------------------------
        // Private variables

        var calculations = environment.db().getSchema().table('calculations');
        var backlog = [];

        // --------------------------------------------------
        // Private functions

        function execLocal(proc) {
            $logger.append('debug', 'Executing local calculation: ' + proc.item.uuid);
            service.info.callback();
            return bluebird.bind(proc).then(function() {
                if (this.item.dependencies.length > 0) {
                    return bluebird.bind(this).then(function() {
                        return environment.db().select().from(calculations)
                            .where(calculations.uuid.in(this.item.dependencies))
                            .exec();
                    }).then(function(rows) {
                        for (var i = 0; i < rows.length; ++i) {
                            if (rows[i].status === 'failed') {
                                return false;
                            }
                        }
                        return true;
                    });
                } else {
                    return true;
                }
            }).then(function(success) {
                if (!success) {
                    return environment.db().update(calculations)
                        .set(calculations.status, 'failed')
                        .where(calculations.uuid.eq(this.item.uuid))
                        .exec();
                } else {
                    return bluebird.bind(this).then(function() {
                        var account = this.item.request.function.account;
                        var app = this.item.request.function.app;
                        var args = this.item.request.function.args;
                        var parameters = this.item.declaration.schema.function_type.parameters;
                        var values = [];
                        for (var i = 0; i < args.length; ++i) {
                            if (typeof args[i].value !== 'undefined') {
                                values.push({
                                    'args': args,
                                    'index': i,
                                    'value': args[i].value,
                                    'schema': $manifest.stringify(parameters[i].schema, account, app)
                                });
                            }
                        }
                        if (values.length > 0) {
                            return bluebird.bind(this).then(function() {
                                return values;
                            }).each(function(arg) {
                                return $http({
                                    "method": 'POST',
                                    "url": session.url('/iss/:type', {
                                        "type": arg.schema
                                    }, {
                                        "context": service.info.context
                                    }, true),
                                    "headers": {
                                        "Authorization": 'Bearer ' + session.token(),
                                        "Content-Type": 'application/json'
                                    },
                                    "data": JSON.stringify(arg.value)
                                }).then(function(res) {
                                    arg.args[arg.index] = {
                                        'reference': res.data.id
                                    };
                                });
                            });
                        }
                    }).then(function() {
                        if (this.item.status === 'unresolved') {
                            this.item.status = 'resolved';
                            return environment.db().update(calculations)
                                .set(calculations.status, 'resolved')
                                .set(calculations.request, this.item.request)
                                .where(calculations.uuid.eq(this.item.uuid))
                                .exec();
                        }
                    }).then(function() {
                        return supervisor.stage(this.item);
                    }).then(function() {
                        if (this.item.failure) {
                            return environment.db().update(calculations)
                                .set(calculations.status, 'failed')
                                .where(calculations.uuid.eq(this.item.uuid))
                                .exec();
                        } else {
                            return environment.db().update(calculations)
                                .set(calculations.status, 'completed')
                                .set(calculations.id, this.item.id)
                                .where(calculations.uuid.eq(this.item.uuid))
                                .exec();
                        }
                    });
                }
            }).then(function() {
                var message = 'Done executing local calculation: ' + this.item.uuid;
                $logger.append('debug', message);
                service.info.callback();
            });
        }

        function execRemote(proc) {
            $logger.append('debug', 'Executing remote calculation: ' + proc.item.uuid);
            service.info.callback();
            return bluebird.bind(proc).then(function() {
                if (this.item.dependencies.length > 0) {
                    this.item.lookup = {};
                    return bluebird.bind(this).then(function() {
                        return environment.db().select().from(calculations)
                            .where(calculations.uuid.in(this.item.dependencies))
                            .exec();
                    }).then(function(rows) {
                        for (var i = 0; i < rows.length; ++i) {
                            if (rows[i].status === 'failed') {
                                return false;
                            }
                            this.item.lookup[rows[i].uuid] = rows[i].id;
                        }
                        return true;
                    });
                } else {
                    return true;
                }
            }).then(function(success) {
                if (!success) {
                    return environment.db().update(calculations)
                        .set(calculations.status, 'failed')
                        .where(calculations.uuid.eq(this.item.uuid))
                        .exec();
                } else {
                    return bluebird.bind(this).then(function() {
                        var i, p, item, items = [];
                        if (this.item.type === 'array') {
                            items = items.concat(this.item.request.array.items);
                            for (i = 0; i < items.length; ++i) {
                                item = items[i];
                                if (ure.test(item.reference)) {
                                    item.reference = this.item.lookup[item.reference];
                                }
                            }
                        } else if (this.item.type === 'cast') {
                            item = this.item.request.cast.object;
                            if (ure.test(item.reference)) {
                                item.reference = this.item.lookup[item.reference];
                            }
                        } else if (this.item.type === 'function') {
                            items = items.concat(this.item.request.function.args);
                            for (i = 0; i < items.length; ++i) {
                                item = items[i];
                                if (ure.test(item.reference)) {
                                    item.reference = this.item.lookup[item.reference];
                                }
                            }
                        } else if (this.item.type === 'item') {
                            items.push(this.item.request.item.index);
                            items.push(this.item.request.item.array);
                            for (i = 0; i < items.length; ++i) {
                                item = items[i];
                                if (ure.test(item.reference)) {
                                    item.reference = this.item.lookup[item.reference];
                                }
                            }
                        } else if (this.item.type === 'object') {
                            for (p in this.item.request.object.properties) {
                                item = this.item.request.object.properties[p];
                                if (ure.test(item.reference)) {
                                    item.reference = this.item.lookup[item.reference];
                                }
                            }
                        } else if (this.item.type === 'property') {
                            items.push(this.item.request.property.field);
                            items.push(this.item.request.property.object);
                            for (i = 0; i < items.length; ++i) {
                                item = items[i];
                                if (ure.test(item.reference)) {
                                    item.reference = this.item.lookup[item.reference];
                                }
                            }
                        }
                    }).then(function() {
                        return $http({
                            "method": 'POST',
                            "url": session.url('/calc', null, {
                                "context": service.info.context
                            }, true),
                            "headers": {
                                "Authorization": 'Bearer ' + session.token(),
                                "Content-Type": 'application/json'
                            },
                            "data": this.item.request
                        });
                    }).then(function(res) {
                        this.id = res.data.id;
                        return $http({
                            "method": 'GET',
                            "url": session.url('/calc/:id', {
                                "id": this.id
                            }, {
                                "context": service.info.context
                            }, true),
                            "headers": {
                                "Authorization": 'Bearer ' + session.token()
                            }
                        });
                    }).then(function(res) {
                        this.request = res.data;
                        return waitForFinished(this.id);
                    }).then(function() {
                        return environment.db().update(calculations)
                            .set(calculations.status, 'completed')
                            .set(calculations.id, this.id)
                            .set(calculations.request, this.request)
                            .where(calculations.uuid.eq(this.item.uuid))
                            .exec();
                    });
                }
            }).then(function() {
                var message = 'Done executing remote calculation: ' + this.item.uuid;
                $logger.append('debug', message);
                service.info.callback();
            });
        }

        function exec() {
            if ((service.info.state !== 'registered' && service.info.state !== 'waiting') ||
                backlog.length === 0) {
                return;
            }
            if (service.info.state === 'registered') {
                service.info.state = "executing";
                service.info.callback();
            } else {
                service.info.state = "staged";
                service.info.callback();
            }

            // Execute first item from backlog
            return bluebird.bind({
                "item": backlog.shift()
            }).then(function() {
                if (this.item.target === 'local') {
                    return execLocal(this);
                } else {
                    return execRemote(this);
                }
            }).then(function() {
                service.info.state = "registered";
                service.info.callback();
                if (backlog.length > 0) {
                    exec();
                }
            });
        }

        function pushDependencies(src, dest) {
            for (var i = 0; i < src.length; ++i) {
                if (typeof src[i].value === 'undefined') {
                    dest.push(src[i].reference);
                }
            }
        }

        function processArray(params) {
            return bluebird.bind({
                "array": params.request.array,
                "target": "remote"
            }).then(function() {
                return this.array.items;
            }).map(function(arg) {
                return process({
                    "request": arg
                });
            }, SERIAL).then(function(args) {

                // Create resolved request
                var resolved = {
                    "array": {
                        "item_schema": this.array.item_schema,
                        "items": args
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies(args, dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "type": "array",
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function processCast(params) {
            return bluebird.bind({
                "cast": params.request.cast,
                "target": "remote"
            }).then(function() {
                return process({
                    "request": this.cast.object
                });
            }).then(function(obj) {

                // Create resolved request
                var resolved = {
                    "cast": {
                        "schema": this.cast.schema,
                        "object": obj
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies([obj], dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "type": "cast",
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function processFunction(params) {
            return bluebird.bind({
                "function": params.request.function,
                "account": params.request.function.account,
                "app": params.request.function.app,
                "name": params.request.function.name
            }).then(function() {
                if (this.account === service.info.account && this.app === service.info.app) {
                    this.target = "local";
                    this.declaration = _.find($manifest.functions, 'name', this.name);
                } else {
                    this.target = "remote";
                    this.declaration = null;
                }
                return this.function.args;
            }).map(function(arg) {
                return process({
                    "request": arg,
                    // expected_schema: item.schema,
                    // dry_run: params.dry_run,
                    // force_run: params.force_run,
                    // entropy: params.entropy,
                    // with_logs: params.with_logs
                });
            }, SERIAL).then(function(args) {

                // Create resolved request
                var resolved = {
                    "function": {
                        "account": this.account,
                        "app": this.app,
                        "name": this.name,
                        "args": args
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies(args, dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "declaration": this.declaration,
                    "type": "function",
                    "account": this.account,
                    "app": this.app,
                    "name": this.name,
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function processItem(params) {
            return bluebird.bind({
                "item": params.request.item,
                "target": "remote"
            }).then(function() {
                return [this.item.index, this.item.array];
            }).map(function(arg) {
                return process({
                    "request": arg
                });
            }, SERIAL).then(function(args) {

                // Create resolved request
                var resolved = {
                    "item": {
                        "index": args[0],
                        "schema": this.item.schema,
                        "array": args[1]
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies(args, dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "type": "item",
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function processObject(params) {
            return bluebird.bind({
                "object": params.request.object,
                "target": "remote"
            }).then(function() {
                this.keys = _.keys(this.object.properties);
                return this.keys;
            }).map(function(key) {
                return process({
                    "request": this.object.properties[key]
                });
            }, SERIAL).then(function(args) {
                var properties = {};
                for (var i = 0; i < this.keys.length; ++i) {
                    properties[this.keys[i]] = args[i];
                }

                // Create resolved request
                var resolved = {
                    "object": {
                        "schema": this.object.schema,
                        "properties": properties
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies(args, dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "type": "object",
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function processProperty(params) {
            return bluebird.bind({
                "property": params.request.property,
                "target": "remote"
            }).then(function() {
                return [this.property.field, this.property.object];
            }).map(function(arg) {
                return process({
                    "request": arg
                });
            }, SERIAL).then(function(args) {

                // Create resolved request
                var resolved = {
                    "property": {
                        "field": args[0],
                        "schema": this.property.schema,
                        "object": args[1]
                    }
                };

                // Identify dependencies
                var dependencies = [];
                pushDependencies(args, dependencies);

                // Register calculation
                return register({
                    "uuid": uuid.v4(),
                    "target": this.target,
                    "type": "property",
                    "request": resolved,
                    "dependencies": dependencies
                });
            }).then(function(item) {
                return {
                    "reference": item.uuid
                };
            });
        }

        function process(params) {
            var req = params.request;
            if (typeof req["function"] !== 'undefined') {
                return processFunction(params);
            } else if (typeof req.value !== 'undefined') {
                return bluebird.resolve(params.request);
            } else if (typeof req.reference !== 'undefined') {
                return bluebird.resolve(params.request);
            } else if (typeof req.array !== 'undefined') {
                return processArray(params);
            } else if (typeof req.item !== 'undefined') {
                return processItem(params);
            } else if (typeof req.object !== 'undefined') {
                return processObject(params);
            } else if (typeof req.property !== 'undefined') {
                return processProperty(params);
            } else if (typeof req.cast !== 'undefined') {
                return processCast(params);
            }
            return bluebird.reject(new Error("Not implemented"));
        }

        function register(item) {
            return bluebird.bind({}).then(function() {

                // Generate stable hash
                this.hash = crypto.createHash('sha256').update(stringify({
                    "target": item.target,
                    "context": service.info.context,
                    "request": item.request
                }), 'utf8').digest().toString('hex');

                // Attempt to insert calculation into database
                var row = calculations.createRow({
                    "uuid": item.uuid,
                    "target": item.target,
                    "type": item.type,
                    "hash": this.hash,
                    "status": "unresolved"
                });
                return environment.db().insert().into(calculations).values([row]).exec();
            }).catch(function(err) {
                if (err.code !== 201) {
                    throw err;
                }

                // Select existing calculation if duplicate is found
                return bluebird.bind(this).then(function() {
                    var filter = calculations.hash.eq(this.hash);
                    return environment.db().select().from(calculations).where(filter).exec();
                }).then(function(rows) {
                    item.uuid = rows[0].uuid;
                    item.status = rows[0].status;
                    if (typeof rows[0].request !== 'undefined' && rows[0].request !== null) {
                        item.request = rows[0].request;
                    }
                });
            }).then(function() {

                // Add item to backlog and return
                if (item.status !== 'completed') {
                    backlog.push(item);
                }
                return item;
            });
        }

        function waitForFinished(id, count) {
            count = count || 0;
            return $http({
                method: 'GET',
                url: session.url('/calc/:id/status', {
                    'id': id
                }, {
                    'context': service.info.context,
                    'status': 'completed'
                }, true),
                headers: {
                    'Authorization': 'Bearer ' + session.token()
                }
            }).then(function(res) {
                if (typeof res.data.completed === 'undefined') {
                    if (count < 10) {
                        return waitForFinished(id, count + 1);
                    } else {
                        throw new Error("Need to handle long running remote calculations better");
                    }
                }
            });
        }

        // --------------------------------------------------
        // Service members

        this.info = {
            'enabled': false,
            'state': 'idle',
            'target': null,
            'context': null,
            'pinging': false
        };

        // --------------------------------------------------
        // Service methods

        this.clear = function() {
            backlog.length = 0;
            return bluebird.resolve();
        };

        this.close = function() {
            if (!this.info.enabled) {
                throw new Error("Invalid attempt to stop proxy when proxy is already disabled");
            }
            $logger.append("debug", "Stopping proxy.");
            return bluebird.bind(this).then(function() {
                return close();
            }).then(function() {
                return supervisor.close();
            }).then(function() {
                $logger.append("debug", "Stopped proxy.");
                this.info.enabled = false;
                this.info.state = "idle";
                this.info.target = null;
                this.info.account = null;
                this.info.app = null;
                this.info.context = null;
                this.info.callback = null;
                this.info.pinging = false;
                supervisor.init();
            });
        };

        this.listen = function(config) {
            if (this.info.enabled) {
                throw new Error("Invalid attempt to start proxy when proxy is already enabled");
            }
            $logger.append("debug", "Starting proxy.");
            return bluebird.bind(this).then(function() {
                return listen(4345);
            }).then(function() {
                supervisor.context(config.context);
                return supervisor.listen(config.port, 'localhost');
            }).then(function() {
                this.info.enabled = true;
                this.info.state = "waiting";
                this.info.target = session.api();
                this.info.account = config.account;
                this.info.app = config.app;
                this.info.context = config.context;
                this.info.callback = config.callback;
                $logger.append("debug", "Started proxy.");
            });
        };

        this.ping = function() {
            var self = this;
            // Resolve if provider has not registered yet or we are already pinging.
            if (this.info.state === "idle" || this.info.state === "waiting" ||
                this.info.state === "staged") {
                $logger.append("warning", "Cannot ping while in the " + this.info.state + " state");
                return bluebird.resolve();
            }
            if (this.info.pinging) {
                return bluebird.resolve();
            }
            this.info.pinging = true;
            $logger.append("debug", "Sending ping message");
            return supervisor.ping().then(function() {
                self.info.pinging = false;
                $logger.append("debug", "Received pong message");
            });
        };
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register service

    angular.module('app').service('$proxy', [
        'environment',
        'session',
        '$manifest',
        '$rootScope',
        '$http',
        '$logger',
        'Supervisor',
        proxyService
    ]);
})();