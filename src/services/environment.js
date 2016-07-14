(function () {
    'use strict';
    var _ = require('lodash');
    var bluebird = require('bluebird');
    var fs = bluebird.promisifyAll(require('fs-extra'));
    var fspath = require('path');
    var os = require('os');

    var remote = require('remote');
    var app = remote.require('app');

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
    
    /**
     * @summary Initialize the environment by parsing the config and credentials files.
     * @todo Reimplement the creation of a local datastore. https://github.com/thinknode/desktop/issues/28
     * 
     * @returns {Promise} A promise that resolves when configuration and credentials have been parsed
     * and loaded into memory.
     */
    function initialize() {
        if (init) {
            return init;
        }

        // Initialize environment
        return (init = bluebird.resolve().then(function () {
            return fs.ensureDirAsync(root);
        }).then(function () {
            return fs.ensureDirAsync(dir);
        }).then(function () {
            return fs.ensureDirAsync(cache);
        }).then(function () {
            return parseConfiguration();
        }).then(function () {
            return parseCredentials();
        }));

        /*.then(function () {

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
                onUpdate: function () {
                    console.log("on update");
                }
            }).catch(function (err) {
                indexedDB.deleteDatabase("thinknode");
                return builder.connect();
            });
        }).then(function (db) {
            database = db;
        }));*/
    }
    
    /**
     * @summary Parses the configuration file for the application and loads config into memory
     * 
     * @returns {Promise} A promise that resolves when the config has been parsed.
     */
    function parseConfiguration() {
        return bluebird.bind({
            filename: fspath.join(dir, 'config.json')
        }).then(function () {
            return fs.readFileAsync(this.filename);
        }).catch(function (err) {
            if (err.code === 'ENOENT') {
                var data = JSON.stringify(defaults, null, 2);
                return fs.writeFileAsync(this.filename, data).then(function () {
                    return data;
                });
            } else {
                throw err;
            }
        }).then(function (data) {
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
    
    /**
     * @summary Parse the user credentials file and stores credentials in memory
     * 
     * @returns {Promise} A promise that resolves when the credentials have been parsed.
     */
    function parseCredentials() {
        return bluebird.bind({
            filename: fspath.join(root, 'credentials.json')
        }).then(function () {
            return fs.readFileAsync(this.filename);
        }).catch(function (err) {
            if (err.code === 'ENOENT') {
                var data = JSON.stringify({}, null, 2);
                return fs.writeFileAsync(this.filename, data).then(function () {
                    return data;
                });
            } else {
                throw err;
            }
        }).then(function (data) {
            creds = JSON.parse(data);
            if (config.username && config.host) {
                var key = config.username + '@' + config.host;
                if (creds.hasOwnProperty(key)) {
                    activeProfile = creds[key];
                }
            }
        });
    }
    
    /**
     * @summary Save the application configuration file asynchronously.
     * 
     * @returns {Promise} A promise that resolves when the config has been saved.
     */
    function saveConfiguration() {
        var data = JSON.stringify(config, null, 2);
        return fs.writeFileAsync(fspath.join(dir, 'config.json'), data);
    }
    
    /**
     * @summary Save the application configuration file synchronously
     * 
     * @returns {void}
     */
    function saveConfigurationSync() {
        var data = JSON.stringify(config, null, 2);
        fs.writeFileSync(fspath.join(dir, 'config.json'), data);
    }
    
    /**
     * @summary Save the application credentals file asynchronously.
     * 
     * @returns {Promise} A promise that resolves when the credentials file has been saved.
     */
    function saveCredentials() {
        var data = JSON.stringify(creds, null, 2);
        return fs.writeFileAsync(fspath.join(root, 'credentials.json'), data);
    }
    
    /**
     * @summary Save the credentials file synchronously.
     * 
     * @returns {void}
     */
    function saveCredentialsSync() {
        var data = JSON.stringify(creds, null, 2);
        fs.writeFileSync(fspath.join(root, 'credentials.json'), data);
    }
    
    /**
     * @summary Constructor for the environment service.
     * 
     * @constructor
     * @param {object} $q - Angular $q library injected by the framework
     * @returns {environment_L1.EnvironmentService}
     */
    function EnvironmentService($q) {
        this.$q = $q;
    }
    
    /**
     * @summary Thin wrapper method around the local initialize() method
     * 
     * @returns {Promise} A promise that resolves when the application environment has initialized.
     */
    EnvironmentService.prototype.init = function () {
        return initialize();
    };
    
    /**
     * @summary Activate a users profile as the current account environment in use in the application.
     * 
     * @param {object} profile
     * @returns {void}
     */
    EnvironmentService.prototype.activate = function (profile) {
        config.username = profile.username;
        config.host = profile.host;
        saveConfigurationSync();
        activeProfile = profile;
    };
    
    /**
     * @summary Return a path to the cache item represented by the id or thec cache directory if no id supplied.
     * 
     * @param {string} id
     * @returns {string} A path to a cache file or directory.
     */
    EnvironmentService.prototype.cache = function (id) {
        if (typeof id === 'string') {
            return fspath.join(cache, id);
        } else {
            return cache;
        }
    };
    
    /**
     * @summary Clear calculations by removing local calculations artifact files.
     * @todo Reimplement deleting calculations from local datastore. 
     * https://github.com/thinknode/desktop/issues/28
     * 
     * @returns {Promise} A promise that resolves when the calculations artifacts file is removed.
     */
    EnvironmentService.prototype.clearCalculations = function () {
        var self = this;
        return fs.removeAsync(cache).then(function () {
            return fs.ensureDirAsync(cache);
        });
        /*.then(function () {
            var calculations = self.db().getSchema().table('calculations');
            return self.db().delete().from(calculations).exec();
        });*/
    };
    
    /**
     * @summary Get the credentials stored in memory
     * 
     * @returns {Object} Credentials object containing credentials for users logged in.
     */
    EnvironmentService.prototype.credentials = function () {
        return creds;
    };
    
    /**
     * @summary Get the value for a configuration property.
     * 
     * @param {string} key - Property in config variable whose value will be returned.
     * @returns {mixed} A value from the config object that is stored in memory.
     */
    EnvironmentService.prototype.config = function (key) {
        return config[key];
    };
    
    /**
     * @summary Get the local datastore
     * @todo Reimplement returning the datastore. 
     * https://github.com/thinknode/desktop/issues/28
     * 
     * @returns {void}
     */
    EnvironmentService.prototype.db = function () {
        //return database;
    };
    
    /**
     * @summary Deactivate the current active user tied to the state of the environment.
     * 
     * @returns {void}
     */
    EnvironmentService.prototype.deactivate = function () {
        config.username = null;
        config.host = null;
        saveConfigurationSync();
    };
    
    /**
     * @summary Save or return an active profile for the environment.
     * 
     * @param {string} key - Namespace for the profile that will be saved in memory.
     * @param {object} value - Profile associated with the namespace
     * @returns {object|void} Returns the active profile if no value is passed; othwerwise void.
     */
    EnvironmentService.prototype.profile = function (key, value) {
        if (typeof value !== 'undefined') {
            creds[key] = value;
            activeProfile = value;
            saveCredentialsSync();
        } else {
            return activeProfile;
        }
    };
    
    /**
     * @summary Delete a user profile.
     * 
     * @param {string} key - Namespace for the profile we are deleting
     * @returns {void}
     */
    EnvironmentService.prototype.forget = function (key) {
        config.username = null;
        config.host = null;
        saveConfigurationSync();

        delete creds[key];
        saveCredentialsSync();
    };
    
    /**
     * @summary Check if the environment instance has loaded credentials into memory.
     * 
     * @returns {Boolean} True if the environment has loaded credentials; otherwise false.
     */
    EnvironmentService.prototype.hasCredentials = function () {
        return creds && !_.isEmpty(creds);
    };
    
    /**
     * @summary Set and/or get the host value for the current environment.
     * 
     * @param {string} value - Value to apply to the current host property in the environment config
     * for the active profile. 
     * @returns {string} The host string
     */
    EnvironmentService.prototype.host = function (value) {
        if (typeof value === 'string') {
            config.host = value;
            saveConfigurationSync();
        }
        return config.host;
    };
    
    /**
     * @summary Updates the current environments profile
     * 
     * @param {object} profile - Profile we want to apply to the current environment.
     * @returns {void}
     */
    EnvironmentService.prototype.update = function (profile) {
        if (!_.isEqual(activeProfile, profile)) {
            activeProfile = profile;
            creds[profile.username + '@' + profile.host] = profile;
            saveCredentialsSync();
        }
    };
    
    // --------------------------------------------------
    // Service definition
    
    angular.module('app').service('environment', [
        '$q',
        EnvironmentService
    ]);
})();

