/*
 * Manifest Service
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Service

    function manifestService($session, $rootScope) {
        /* jshint validthis: true */

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');
        var fs = bluebird.promisifyAll(require('fs'));
        var fspath = require('path');

        // --------------------------------------------------
        // Private variables

        // --------------------------------------------------
        // Private functions

        function clean(src) {
            for (var i = 0; i < src.length; ++i) {
                src[i].dirty = false;
            }
        }

        function copy(src, dest) {
            dest.length = 0;
            for (var i = 0; i < src.length; ++i) {
                var clone = _.cloneDeep(src[i]);
                clone.dirty = false;
                dest.push(clone);
            }
        }

        function prune(src) {
            return src.map(function(item) {
                return _.omit(item, ['dirty', '$$hashKey']);
            });
        }

        // --------------------------------------------------
        // Service members

        this.app = null;
        this.manifest = null;
        this.temp = null;

        this.dependencies = [];
        this.types = [];
        this.functions = [];
        this.upgrades = [];
        this.records = [];

        // --------------------------------------------------
        // Service methods

        this.load = function(app) {
            this.app = app;
            return bluebird.bind(this).then(function() {
                return fs.readFileAsync(fspath.join(this.app.path, 'manifest.json'));
            }).then(function(data) {
                this.manifest = JSON.parse(data);
                for (var p in this.manifest) {
                    copy(this.manifest[p], this[p]);
                }
                $rootScope.$apply();
            });
        };

        this.delete = function(cls, name) {
            return bluebird.bind(this).then(function() {
                this.temp = _.cloneDeep(this.manifest);
                var index = _.findIndex(this.temp[cls], 'name', name);
                this.temp[cls].splice(index, 1);
                var data = JSON.stringify(this.temp, null, 2);
                return fs.writeFileAsync(fspath.join(this.app.path, 'manifest.json'), data);
            }).then(function() {
                this.manifest = this.temp;
                this.temp = null;
                $rootScope.$apply();
            });
        };

        this.save = function(cls, name) {
            return bluebird.bind(this).then(function() {
                this.temp = _.cloneDeep(this.manifest);
                var item = _.find(this[cls], 'name', name);
                var index = _.findIndex(this.temp[cls], 'name', name);
                if (index > -1) {
                    this.temp[cls][index] = _.omit(item, ['dirty', '$$hashKey']);
                } else {
                    this.temp[cls].push(_.omit(item, ['dirty', '$$hashKey']));
                }
                var data = JSON.stringify(this.temp, null, 2);
                return fs.writeFileAsync(fspath.join(this.app.path, 'manifest.json'), data);
            }).then(function() {
                this.manifest = this.temp;
                this.temp = null;
                var item = _.find(this[cls], 'name', name);
                item.dirty = false;
                $rootScope.$apply();
            });
        };

        this.saveAll = function() {
            return bluebird.bind(this).then(function() {
                this.temp = {
                    'dependencies': prune(this.dependencies),
                    'types': prune(this.types),
                    'functions': prune(this.functions),
                    'upgrades': prune(this.upgrades),
                    'records': prune(this.records)
                };
                var data = JSON.stringify(this.temp, null, 2);
                return fs.writeFileAsync(fspath.join(this.app.path, 'manifest.json'), data);
            }).then(function() {
                this.manifest = this.temp;
                this.temp = null;
                clean(this.dependencies);
                clean(this.types);
                clean(this.functions);
                clean(this.upgrades);
                clean(this.records);
                $rootScope.$apply();
            });
        };

        this.stringify = function(schema, account, app) {
            if (typeof schema.string_type !== 'undefined') {
                return 'string';
            } else if (typeof schema.integer_type !== 'undefined') {
                return 'integer';
            } else if (typeof schema.float_type !== 'undefined') {
                return 'float';
            } else if (typeof schema.boolean_type !== 'undefined') {
                return 'boolean';
            } else if (typeof schema.blob_type !== 'undefined') {
                return 'blob';
            } else if (typeof schema.nil_type !== 'undefined') {
                return 'nil';
            } else if (typeof schema.datetime_type !== 'undefined') {
                return 'datetime';
            } else if (typeof schema.dynamic_type !== 'undefined') {
                return 'dynamic';
            } else if (typeof schema.array_type !== 'undefined') {
                return 'array/' + this.stringify(schema.array_type.element_schema, account, app);
            } else if (typeof schema.enum_type !== 'undefined') {
                throw new Error("Anonymous enum types are not yet supported");
            } else if (typeof schema.map_type !== 'undefined') {
                var key = this.stringify(schema.map_type.key_schema, account, app);
                var value = this.stringify(schema.map_type.value_schema, account, app);
                return 'map/' + key + '/' + value;
            } else if (typeof schema.named_type !== 'undefined') {
                account = schema.named_type.account || account;
                app = schema.named_type.account || app;
                return 'named/' + account + '/' + app + '/' + schema.named_type.name;
            } else if (typeof schema.optional_type !== 'undefined') {
                throw new Error("Anonymous optional types are not yet supported");
            } else if (typeof schema.structure_type !== 'undefined') {
                throw new Error("Anonymous structure types are not yet supported");
            } else if (typeof schema.reference_type !== 'undefined') {
                throw new Error("Anonymous reference types are not yet supported");
            } else if (typeof schema.union_type !== 'undefined') {
                throw new Error("Anonymous union types are not yet supported");
            } else {
                throw new Error("Unrecognized or invalid schema type");
            }
        };
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register service

    angular.module('app').service('$manifest', ['$session', '$rootScope', manifestService]);
})();