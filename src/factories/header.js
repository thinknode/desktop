/*
 * headerHttpInterceptor Factory
 *
 * An http interceptor that applies the headers to rootScope
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function () {
    'use strict';

    function headerHttpInterceptor($rootScope, $q) {

        return {
            request: function (config) {
                var h = {};
                if (config.headers.Authorization && config.headers.Authorization.match(/Bearer/)) {
                    h = config.headers;
                }
                // Pretty print the JSON
                $rootScope.requestHeaders = angular.toJson(h, true);
                return $q.when(config);
            },
            response: function (res) {
                var h = {};
                if (res.config.headers.Authorization && res.config.headers.Authorization.match(/Bearer/)) {
                    h = res.headers();
                }
                // Pretty print the JSON
                $rootScope.responseHeaders = angular.toJson(h, true);
                return $q.when(res);
            },
            responseError: function (res) {
                var h = {};
                if (res.config.headers.Authorization && res.config.headers.Authorization.match(/Bearer/)) {
                    h = res.headers();
                }
                // Pretty print the JSON
                $rootScope.responseHeaders = angular.toJson(h, true);
                return $q.reject(res);
            }
        };
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register factory

    angular.module('app').factory('headerHttpInterceptor', [
        '$rootScope',
        '$q',
        headerHttpInterceptor
    ]);
})();