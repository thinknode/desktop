/*
 *  app storage provider
 *
 *  Defines the storageProvider which is responsible for providing an interface to interact with the
 *  localstorage database.
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function () {

    'use strict';

    var _ = require('lodash');

    // Master dictionary of namespaces.
    var _namespaces;

    function StorageProviderFactory() {

        function _initNamespaces() {
            var n = {};
            localStorage.setItem('namespaces', JSON.stringify(n));
            _namespaces = n;
        }

        /**
         * Construct the StorageProvider which provides an interface to localStorage which
         * will namespace keys according to account identifiable information found fed through the 
         * Session service.
         *
         * @param {object} $q - Promise library provided by Agnular
         * @param {object} session - Session service
         * @constructor
         */
        function StorageProvider($q, session) {
            this._$q = $q;
            this._localStorage = localStorage;
            this._session = session;
            this.NAMESPACES_KEY = 'namespaces';
            if (!_namespaces) {
                if (!this._localStorage.getItem(this.NAMESPACES_KEY)) {
                    _initNamespaces();
                } else {
                    // Wrapped in try/catch just in case JSON string is tampered and corrupted
                    try {
                        _namespaces = JSON.parse(this._localStorage.getItem(this.NAMESPACES_KEY));
                    } catch (e) {
                        _initNamespaces();
                    }
                }
            }
        }


        /**
         * @summary Set an item into localStorage for the current domain.
         *
         * @param {string} key - Key reference to the item being stored.
         * @param {mixed} value - Item that is being stored.
         * @returns {boolean} True if item set; otherwise false.
         */
        StorageProvider.prototype.set = function (key, value) {
            // Exception that could happen here is a circular reference
            try {
                value = JSON.stringify(value);
            } catch (e) {
                console.error(e);
                return false;
            }

            var n = this.getNamespace();

            if (typeof _namespaces[n] === "undefined") {
                _namespaces[n] = [];
            }

            if (_namespaces[n].indexOf(key) === -1) {
                _namespaces[n].push(key);
                this._localStorage.setItem(this.NAMESPACES_KEY, JSON.stringify(_namespaces));
            }
            this._localStorage.setItem(n + key, value);
            return true;
        };

        /**
         * Retrive an item from localStorage. If the item can be JSON parsed it will be, otherwise
         * the raw item is returned.
         *
         * @param {string} key - Key reference to the item being retrieved from storage
         * @returns {mixed} Item being retrieved from localStorage.
         */
        StorageProvider.prototype.get = function (key) {
            var item = this._localStorage.getItem(this.getNamespace() + key);
            if (item && item.length) {
                var i;
                try {
                    i = JSON.parse(item);
                } catch (e) {
                    i = item;
                }
                return i;
            }
        };

        /**
         * Delete a key from localStorage
         *
         * @param {string} key
         * @returns {void}
         */
        StorageProvider.prototype.del = function (key) {
            var ns = this.getNamespace();
            _namespaces[ns] = _.remove(_namespaces[ns], key);
            this._localStorage.setItem(this.NAMESPACES_KEY, JSON.stringify(_namespaces));
            return this._localStorage.removeItem(this.getNamespace() + key);
        };

        /**
         * Delete keys related to a namespace and delete namespace from the master dictionary and 
         * from localStorage
         * 
         * @param {string} ns - Namespace id that will be deleted. If not passed, current namespace
         *                      is used
         * @returns {Boolean} True if namespace is found and deleted successfully; otherwise false.
         */
        StorageProvider.prototype.delNamespace = function (ns) {
            if (!ns) {
                ns = this.getNamespace();
            }
            if (_namespaces[ns]) {
                for (var k = 0; k < _namespaces[ns].length; k++) {
                    this._localStorage.removeItem(ns + _namespaces[ns][k]);
                }
                delete _namespaces[ns];
                this._localStorage.setItem(this.NAMESPACES_KEY, JSON.stringify(_namespaces));
                return true;
            } else {
                return false;
            }
        };

        /**
         * Get all the keys in localStorage
         *
         * @returns {Array} An array of storage keys in localStorage
         */
        StorageProvider.prototype.getKeys = function () {
            return Object.keys(this._localStorage);
        };

        /**
         * Generate a namespace that is representative of the current session profile
         * 
         * @returns {String} Namespace
         */
        StorageProvider.prototype.getNamespace = function () {
            var base = '';

            if (this._session._profile.host.match(/thinknode.io/)) {
                var pieces = this._session._profile.host.split('.');
                base = pieces[1] + '.' + pieces[2] + '>' + pieces[0];
            } else {
                base = this._session._profile.host;
            }
            return base + '>' + this._session._profile.username + '>';
        };

        this.$get = [
            '$q',
            'session',
            function ($q, session) {
                return new StorageProvider($q, session);
            }
        ];
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register provider

    angular.module('app').provider('storageProvider', StorageProviderFactory);

})();
