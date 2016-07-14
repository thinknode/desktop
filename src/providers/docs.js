/*
 * Docs Provider
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Provider

    function docsProvider() {
        /* jshint validthis: true */

        // --------------------------------------------------
        // Private variables

        // --------------------------------------------------
        // Provider methods

        // --------------------------------------------------
        // Service

        function Docs(environment, $http, $q, docsUrl) {
            this.environment = environment;
            this.$http = $http;
            this.$q = $q;
            this._root = docsUrl;
            
            this._version = 'v1.0';
            this._base = this._root + '/' + this._version;

            this._index = undefined;
            this._services = {};
            this._modules = {};
            this._types = {};
        }

        Docs.prototype.version = function(value) {
            if (typeof value === 'string' && this._version !== value) {
                this._version = value;
                this._index = undefined;
                this._services = {};
                this._modules = {};
                this._types = {};
            }
            return this._version;
        };

        Docs.prototype.index = function() {
            if (!this._index) {
                this._index = this.$http({
                    method: 'GET',
                    url: this._root + '/index.json'
                }).then(function(res) {
                    return res.data;
                });
            }
            return this._index;
        };

        Docs.prototype.module = function(service, name) {
            if (!this._modules[service]) {
                this._modules[service] = {};
            }
            if (!this._modules[service][name]) {
                this._modules[service][name] = this.$http({
                    method: 'GET',
                    url: this._base + '/services/' + service + '/' + name + '.json'
                }).then(function(res) {
                    return res.data;
                });
            }
            return this._modules[service][name];
        };

        Docs.prototype.service = function(id) {
            if (!this._services[name]) {
                this._services[name] = this.$http({
                    method: 'GET',
                    url: this._root + '/' + this._version + '/services/' + id + '.json'
                }).then(function(res) {
                    return res.data;
                });
            }
            return this._services[name];
        };

        Docs.prototype.services = function() {
            if (!this._services.index) {
                this._services.index = this.$http({
                    method: 'GET',
                    url: this._root + '/' + this._version + '/services.json'
                }).then(function(res) {
                    return res.data;
                });
            }
            return this._services.index;
        };

        Docs.prototype.type = function(name) {

        };

        // --------------------------------------------------
        // Provider factory

        this.$get = [
            'environment',
            '$http',
            '$q',
            'DOCS_URL',
            function(environment, $http, $q, docsUrl) {
                return new Docs(environment, $http, $q, docsUrl);
            }
        ];
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register provider

    angular.module('app').provider('$docs', docsProvider);
})();