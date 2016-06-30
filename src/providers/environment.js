/*
 * Session Provider
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    var _ = require('lodash');
    var bluebird = require('bluebird');
    var fs = bluebird.promisifyAll(require('fs-extra'));
    var fspath = require('path');
    var os = require('os');

    var remote = require('remote');
    var app = remote.require('app');


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Provider

    function environmentProvider() {
        /* jshint validthis: true */

        var provider = this;

        // --------------------------------------------------
        // Local variables

        var root = fspath.join(app.getPath('home'), '.thinknode');
        var dir = fspath.join(root, 'thinknode');
        var cache = fspath.join(dir, 'cache');

        var defaults = {
            "host": null,
            "username": null,
            "docs": "https://cdn.thinknode.com/docs"
        };

        var init = null;
        var config = null;
        var creds = null;
        var database = null;
        var activeProfile = null;

        // --------------------------------------------------
        // Local functions

        function initialize() {
            if (init) {
                return init;
            }

            // Initialize environment
            return (init = bluebird.resolve().then(function() {
                return fs.ensureDirAsync(root);
            }).then(function() {
                return fs.ensureDirAsync(dir);
            }).then(function() {
                return fs.ensureDirAsync(cache);
            }).then(function() {
                return parseConfiguration();
            }).then(function() {
                return parseCredentials();
            }).then(function() {

                var builder = lf.schema.create('thinknode', 1);

                builder.createTable('apps')
                    .addColumn('host', lf.Type.STRING)
                    .addColumn('username', lf.Type.STRING)
                    .addColumn('name', lf.Type.STRING)
                    .addColumn('display_name', lf.Type.STRING)
                    .addColumn('description', lf.Type.STRING)
                    .addColumn('path', lf.Type.STRING)
                    .addColumn('commit', lf.Type.STRING)
                    .addColumn('visible', lf.Type.BOOLEAN)
                    .addPrimaryKey(['host', 'username', 'name']);

                builder.createTable('calculations')
                    .addColumn('uuid', lf.Type.STRING)
                    .addColumn('target', lf.Type.STRING)
                    .addColumn('type', lf.Type.STRING)
                    .addColumn('hash', lf.Type.STRING)
                    .addColumn('status', lf.Type.STRING)
                    .addColumn('id', lf.Type.STRING)
                    .addColumn('request', lf.Type.OBJECT)
                    .addPrimaryKey(['uuid'])
                    .addUnique('unique_hash', ['hash'])
                    .addNullable(['id']);

                return builder.connect({
                    onUpdate: function() {
                        console.log("on update");
                    }
                }).catch(function(err) {
                    indexedDB.deleteDatabase("thinknode");
                    return builder.connect();
                });
            }).then(function(db) {
                database = db;
            }));
        }

        function parseConfiguration() {
            return bluebird.bind({
                filename: fspath.join(dir, 'config.json')
            }).then(function() {
                return fs.readFileAsync(this.filename);
            }).catch(function(err) {
                if (err.code === 'ENOENT') {
                    var data = JSON.stringify(defaults, null, 2);
                    return fs.writeFileAsync(this.filename, data).then(function() {
                        return data;
                    });
                } else {
                    throw err;
                }
            }).then(function(data) {
                config = JSON.parse(data);

                // Check for added or deprecated configuration settings
                var updated = false;
                for (var p in defaults) {
                    if (!config.hasOwnProperty(p)) {
                        config[p] = defaults[p];
                        updated = true;
                    }
                }
                for (var q in config) {
                    if (!defaults.hasOwnProperty(q)) {
                        delete config[q];
                        updated = true;
                    }
                }
                if (updated) {
                    return saveConfiguration();
                }
            });
        }

        function parseCredentials() {
            return bluebird.bind({
                filename: fspath.join(root, 'credentials.json')
            }).then(function() {
                return fs.readFileAsync(this.filename);
            }).catch(function(err) {
                if (err.code === 'ENOENT') {
                    var data = JSON.stringify({}, null, 2);
                    return fs.writeFileAsync(this.filename, data).then(function() {
                        return data;
                    });
                } else {
                    throw err;
                }
            }).then(function(data) {
                creds = JSON.parse(data);
                if (config.username && config.host) {
                    var key = config.username + '@' + config.host;
                    if (creds.hasOwnProperty(key)) {
                        activeProfile = creds[key];
                    }
                }
            });
        }

        function saveConfiguration() {
            var data = JSON.stringify(config, null, 2);
            return fs.writeFileAsync(fspath.join(dir, 'config.json'), data);
        }

        function saveConfigurationSync() {
            var data = JSON.stringify(config, null, 2);
            fs.writeFileSync(fspath.join(dir, 'config.json'), data);
        }

        function saveCredentials() {
            var data = JSON.stringify(creds, null, 2);
            return fs.writeFileAsync(fspath.join(root, 'credentials.json'), data);
        }

        function saveCredentialsSync() {
            var data = JSON.stringify(creds, null, 2);
            fs.writeFileSync(fspath.join(root, 'credentials.json'), data);
        }

        // --------------------------------------------------
        // Provider variables

        // --------------------------------------------------
        // Credentials

        // --------------------------------------------------
        // Provider methods

        this.init = [function() {
            return initialize();
        }];

        // --------------------------------------------------
        // Service

        function Environment($q) {
            this.$q = $q;
        }

        Environment.prototype.activate = function(profile) {
            config.username = profile.username;
            config.host = profile.host;
            saveConfigurationSync();
            activeProfile = profile;
        };

        Environment.prototype.cache = function(id) {
            if (typeof id === 'string') {
                return fspath.join(cache, id);
            } else {
                return cache;
            }
        };

        Environment.prototype.clearCalculations = function() {
            var self = this;
            return fs.removeAsync(cache).then(function() {
                return fs.ensureDirAsync(cache);
            }).then(function() {
                var calculations = self.db().getSchema().table('calculations');
                return self.db().delete().from(calculations).exec();
            });
        };

        Environment.prototype.credentials = function() {
            return creds;
        };

        Environment.prototype.config = function(key) {
            return config[key];
        };

        Environment.prototype.db = function() {
            return database;
        };

        Environment.prototype.deactivate = function() {
            config.username = null;
            config.host = null;
            saveConfigurationSync();
        };

        Environment.prototype.profile = function(key, value) {
            if (typeof value !== 'undefined') {
                creds[key] = value;
                activeProfile = value;
                saveCredentialsSync();
            } else {
                return activeProfile;
            }
        };

        Environment.prototype.forget = function(key) {
            config.username = null;
            config.host = null;
            saveConfigurationSync();

            delete creds[key];
            saveCredentialsSync();
        };

        Environment.prototype.hasCredentials = function() {
            return creds && !_.isEmpty(creds);
        };

        Environment.prototype.host = function(value) {
            if (typeof value === 'string') {
                config.host = value;
                saveConfigurationSync();
            }
            return config.host;
        };

        Environment.prototype.initialize = function() {
            return initialize();
        };

        Environment.prototype.update = function(profile) {
            if (!_.isEqual(activeProfile, profile)) {
                activeProfile = profile;
                creds[profile.username + '@' + profile.host] = profile;
                saveCredentialsSync();
            }
        };

        // --------------------------------------------------
        // Provider factory

        this.$get = [
            '$q',
            function($q) {
                return new Environment($q);
            }
        ];
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register provider

    angular.module('app.environment', []).provider('$environment', environmentProvider);
})();