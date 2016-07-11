/*
 * Session Provider
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Provider

    function sessionProvider() {
        /* jshint validthis: true */

        var provider = this;

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var fs = require('fs');
        var fspath = require('path');
        var os = require('os');
        var querystring = require('querystring');

        // --------------------------------------------------
        // Local variables

        var dbApps = null;

        var init = null;
        var initProfile = null;
        var initSession = null;
        var initApps = [];
        var initOpenApps = [];

        // --------------------------------------------------
        // Local functions

        function compareByName(a, b) {
            if (a.name > b.name) {
                return 1;
            } else if (a.name < b.name) {
                return -1;
            } else {
                return 0;
            }
        }

        function isDamaged(path) {
            try {
                var stat = fs.statSync(fspath.resolve(path, 'manifest.json'));
                return false;
            } catch (e) {
                return true;
            }
        }

        function normalizeUrl(host) {
            if (host.indexOf('http') !== 0) {
                host = 'https://' + host + '/api';
            }
            if (host.indexOf('/v1.0') < 0) {
                host += '/v1.0';
            }
            return host;
        }

        // --------------------------------------------------
        // Provider variables

        // --------------------------------------------------
        // Provider methods

        this.currentSession = [
            '$environment',
            '$state',
            '$http',
            '$q',
            function($environment, $state, $http, $q) {
                return $environment.initialize().then(function() {
                    var profile = $environment.profile();
                    if (!profile) {
                        $state.go('auth.select');
                        return $q.reject();
                    } else if (init) {
                        return init;
                    }

                    // Get table schemas
                    dbApps = $environment.db().getSchema().table('apps');

                    // Validate session
                    var url = normalizeUrl(profile.host);
                    return (init = $http({
                        "method": 'GET',
                        "url": url + '/cas/session',
                        "headers": {
                            "Authorization": 'Bearer ' + profile.token
                        }
                    }).then(function(res) {
                        initSession = res.data;
                        initProfile = profile;
                        initProfile.name = res.data.user;
                        return $environment.update(initProfile);
                    }).then(function() {
                        return $http({
                            "method": 'GET',
                            "url": url + '/apm/apps',
                            "headers": {
                                "Authorization": 'Bearer ' + profile.token
                            }
                        });
                    }).then(function(res) {
                        var apps = res.data;
                        for (var i = 0; i < apps.length; ++i) {
                            initApps.push(apps[i]);
                        }
                        initApps.sort(compareByName);
                        return $environment.db().select().from(dbApps).exec();
                    }).then(function(items) {
                        for (var i = 0; i < items.length; ++i) {
                            for (var j = 0; j < initApps.length; ++j) {
                                var cmp = compareByName(items[i], initApps[j]);
                                if (cmp === 0) {
                                    initApps[j].path = items[i].path;
                                    initApps[j].damaged = isDamaged(items[i].path);
                                    break;
                                }
                            }
                        }
                        var namespace = initProfile.host + "." + initSession.domain;
                        var apps = JSON.parse(localStorage.getItem(namespace + '.open_apps')) || [];
                        for (var k = 0; k < apps.length; ++k) {
                            initOpenApps.push(apps[k]);
                        }
                        initOpenApps.sort(compareByName);
                    }).catch(function(err) {
                        // If their session and or domain is no longer valid, redirect them to login
                        $state.go('auth.login');
                    }));
                });
            }
        ];

        // --------------------------------------------------
        // Service

        function Session($http, $q, $base64, $environment) {
            this.$http = $http;
            this.$q = $q;
            this.$base64 = $base64;
            this.$environment = $environment;

            this._profile = initProfile;
            this._current = initSession;
            if (this._profile && this._current) {
                this._namespace = initProfile.host + "." + initSession.domain;
            } else {
                this._namespace = null;
            }

            this._debug = null;

            this.apps = initApps;
            this.openApps = initOpenApps;
        }

        /**
         * @summary Constructs the endpoint for the api.
         *
         * @param {boolean} extern - Indicates the extern property.
         */
        Session.prototype.api = function(extern) {
            if (extern) {
                return normalizeUrl(this.$environment.host());
            } else {
                return normalizeUrl(this._debug ? this._debug : this.$environment.host());
            }
        };

        /**
         * @summary Clears the calculation cache
         */
        Session.prototype.clearCache = function() {
            return this.$environment.clearCalculations();
        };

        /**
         * @summary Closes an app and returns whether the list of open apps is empty
         *
         * @param {string} app - The name of the app to close.
         * @returns {boolean} Indicates whether the list of open apps is empty.
         */
        Session.prototype.closeApp = function(app) {
            _.remove(this.openApps, _.matchesProperty('name', app));
            var apps = _.map(this.openApps, function(open) {
                return {
                    "name": open.name,
                    "display_name": open.display_name
                };
            });
            localStorage.setItem(this._namespace + '.open_apps', JSON.stringify(apps));
            return this.openApps.length === 0;
        };

        /**
         * @summary Creates an app.
         *
         * @param {object} app - The information needed to create an app.
         * @returns {Promise} A promise that resolves once the app has been created or an error has
         *   been handled.
         */
        Session.prototype.createApp = function(app) {
            var self = this;
            return this.$http({
                "method": 'POST',
                "url": this.api() + '/apm/apps',
                "headers": {
                    'Authorization': 'Bearer ' + this.token(),
                    'Content-Type': 'application/json'
                },
                "data": app
            }).then(function(res) {
                var app = res.data;
                self.apps.push(app);
                self.apps.sort(compareByName);
                return true;
            }).catch(function(e) {
                var message = 'Error (' + e.status + '): ' + e.data.message;
                alert(message);
                return false;
            });
        };

        /**
         * @summary Returns the current session.
         *
         * @returns {object} The session object.
         */
        Session.prototype.current = function() {
            return this._current;
        };

        /**
         * @summary Sets debugging on or off.
         *
         * @param {string|boolean} host - The endpoint to use to make requests or `false` to stop
         *   using the proxy endpoint.
         * @param {string} app - The name of the app.
         * @returns {string|object} Either the proxy hostname or `null` if requests are not being
         *   proxied.
         */
        Session.prototype.debug = function(host, app) {
            if (typeof host === 'string') {
                this._debug = host;
                _.find(this.apps, _.matchesProperty('name', app)).debug = true;
                _.find(this.openApps, _.matchesProperty('name', app)).debug = true;
            } else if (host === false) {
                this._debug = null;
                _.find(this.apps, _.matchesProperty('name', app)).debug = false;
                _.find(this.openApps, _.matchesProperty('name', app)).debug = false;
            }
            return this._debug;
        };

        /**
         * @summary Gets the master branch.
         *
         * @param {string} app - The name of the app for which to get the master branch.
         * @param {boolean} include_manifest - Indicates whether to include the manifest.
         * @returns {Promise} A promise that resolves with the branch.
         */
        Session.prototype.getBranch = function(app, branch, include_manifest) {
            return this.$http({
                "method": 'GET',
                "url": this.url('/apm/apps/:account/:app/branches/:branch', {
                    "account": this.current().domain,
                    "app": app,
                    "branch": branch
                }, {
                    "include_manifest": include_manifest === true
                }),
                "headers": {
                    "Authorization": 'Bearer ' + this.token()
                }
            }).then(function(res) {
                return res.data;
            });
        };

        /**
         * @summary Logs into the API.
         *
         * @param {string} username - The username for a user.
         * @param {string} password - The password for a user.
         * @returns {Promise} A promise that resolves after user has been logged in.
         */
        Session.prototype.login = function(username, password) {
            var self = this;
            return this.$http({
                "method": 'GET',
                "url": this.api(true) + '/cas/login',
                "headers": {
                    "Authorization": 'Basic ' + this.$base64.encode(username + ':' + password)
                }
            }).then(function(res) {
                return self.$http.post(self.api(true) + '/cas/tokens', {
                    "description": "Generated by Thinknode Desktop Client for: " + os.hostname()
                }, {
                    "headers": {
                        'Authorization': 'Bearer ' + res.data.token,
                        'Content-Type': 'application/json'
                    }
                });
            }).then(function(res) {
                var key = username + '@' + self.$environment.host();
                self._profile = {
                    "name": res.data.user,
                    "username": username,
                    "host": self.$environment.host(),
                    "token": res.data.token,
                    "tokenKey": res.data.key
                };
                self.$environment.profile(key, self._profile);
                self.$environment.activate(self._profile);
            });
        };

        /**
         * @summary Logs out of the API.
         *
         * @returns {Promise} A promise that resolves after user has been logged out.
         */
        Session.prototype.logout = function() {
            var self = this;
            var key = this._profile.username + '@' + this._profile.host;
            var url = this.api(true);
            var profile = {
                tokenKey: this._profile.tokenKey,
                token: this._profile.token
            };

            this.$environment.forget(key);
            this._profile = null;
            // Handle clients logging out that have not used the new token system.
            if (typeof profile.tokenKey !== "string") {
                return true;
            }
            return this.$http({
                "method": 'DELETE',
                "url": this.api(true) + '/cas/tokens/' + self._profile.tokenKey,
                "headers": {
                    Authorization:"Bearer " + self._profile.token
                }
            }).then(function() {
                self.$environment.forget(key);
                self._profile = null;
                self._namespace = null;
            });
        };

        /**
         * @summary Get the namespace for the current session.
         */
        Session.prototype.namespace = function() {
            return this._namespace;
        };

        /**
         * @summary Opens an app.
         *
         * @param {object} app - The app to open.
         */
        Session.prototype.openApp = function(app) {
            var item = {
                "name": app.name,
                "display_name": app.display_name,
                "debug": app.debug === true
            };
            var idx = _.findIndex(this.openApps, _.matchesProperty('name', app.name));
            if (idx < 0) {
                this.openApps.push(item);
                this.openApps.sort(compareByName);
                var apps = _.map(this.openApps, function(open) {
                    return {
                        "name": open.name,
                        "display_name": open.display_name
                    };
                });
                localStorage.setItem(this._namespace + '.open_apps', JSON.stringify(apps));
            }
        };

        /**
         * @summary Registers an app in the local datastore.
         *
         * @param {object} app - The data to use when registering the app.
         * @returns {Promise} A promise that resolves when the app has been registered.
         */
        Session.prototype.registerApp = function(app) {
            var self = this;
            var item = {
                "host": self._profile.host,
                "username": self._profile.username,
                "name": app.name,
                "display_name": app.display_name,
                "description": app.description,
                "path": app.path,
                "commit": app.commit,
                "visible": true
            };
            var row = dbApps.createRow(item);
            var db = this.$environment.db();
            return db.insertOrReplace().into(dbApps).values([row]).exec();
        };

        /**
         * @summary Saves a manifest to the local filesystem.
         *
         * @param {string} path - The filesystem path under which to save the manifest.
         * @param {object} manifest - The manifest to save.
         * @returns {Promise} Write the file.
         */
        Session.prototype.saveManifest = function(path, manifest) {
            var data = JSON.stringify(manifest, null, 4);
            var filepath = fspath.resolve(path, 'manifest.json');
            return fs.writeFileAsync(filepath, data);
        };

        Session.prototype.switch = function() {
            this.$environment.deactivate();
            self._profile = null;
        };

        /**
         * @summary Get the session token for a user.
         *
         * @returns {string} The session token for the user.
         */
        Session.prototype.token = function() {
            return this._profile.token;
        };

        /**
         * @summary Constructs and returns a url.
         *
         * @param {string} route - The route to use when constructing the url.
         * @param {object} params - An object that enumerates the route parameter key-value pairs.
         * @param {object} query - An object that enumerates the query parameter key-value pairs.
         * @param {boolean} extern - Indicates the extern property.
         * @returns {string} The constructed url.
         */
        Session.prototype.url = function(route, params, query, extern) {
            var url = this.api(extern) + route;
            for (var p in params) {
                if (params.hasOwnProperty(p) && params[p] !== "") {
                    url = url.replace('{:' + p + '}', params[p]);
                    url = url.replace(':' + p, params[p]);
                }
            }
            var qs = querystring.stringify(query);
            if (qs.length > 0) {
                url += "?" + qs;
            }
            return url;
        };

        /**
         * @summary Unregisters an app with the local datastore.
         *
         * @param {string} app - The name of the app to unregister.
         * @returns {Promise} A promise that resolves once the app is unregistered.
         */
        Session.prototype.unregisterApp = function(app) {
            var matches = _.matchesProperty('name', app);
            _.remove(this.openApps, matches);
            var db = this.$environment.db();
            var profile = this._profile;
            var f1 = dbApps.host.eq(profile.host);
            var f2 = dbApps.username.eq(profile.username);
            var f3 = dbApps.name.eq(app);
            var filter = lf.op.and(f1, f2, f3);
            return db.delete().from(dbApps).where(filter).exec();
        };

        Session.prototype.updateApp = function(app) {
            var item = _.find(this.apps, 'name', app.name);
            item.display_name = app.display_name;
            item.description = app.description;
            var row = dbApps.createRow(item);
            var db = this.$environment.db();
            return db.insertOrReplace().into(dbApps).values([row]).exec();
        };

        Session.prototype.validate = function(profile) {
            var self = this;
            self.$environment.activate(profile);
            return self.$http({
                "method": 'GET',
                "url": self.api(true) + '/cas/session',
                "headers": {
                    "Authorization": 'Bearer ' + profile.token
                }
            }).then(function(res) {
                self._profile = profile;
                self._current = res.data;
                var f1 = dbApps.host.eq(profile.host);
                var f2 = dbApps.username.eq(profile.username);
                var filter = lf.op.and(f1, f2);
                return self.$environment.db().select().from(dbApps).where(filter).exec();
            }).then(function(items) {
                self.apps.length = 0;
                for (var i = 0; i < items.length; ++i) {
                    self.apps.push(items[i]);
                }
            });
        };

        // --------------------------------------------------
        // Provider factory

        this.$get = [
            '$http',
            '$q',
            '$base64',
            '$environment',
            function($http, $q, $base64, $environment) {
                return new Session($http, $q, $base64, $environment);
            }
        ];
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register provider

    angular.module('app.session', [
        'app.environment'
    ]).provider('$session', sessionProvider);
})();