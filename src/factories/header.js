/*
 * headerHttpInterceptor Factory
 *
 * An http interceptor that applies the headers to rootScope
 *
 * Copyright (c) 2016 Thinknode Labs, LLC. All rights reserved.
 */

(function () {
    'use strict';

    function standardizeHeaders(config, rawHeaders) {
        var h = {};
        var pieces;
        if (config.headers.Authorization && config.headers.Authorization.match(/Bearer/)) {
            for (var k in rawHeaders) {
                pieces = k.split("-");
                for (var i = 0; i < pieces.length; ++i) {
                    // Uppercase the first character of the word
                    pieces[i] = pieces[i].replace(/\b[a-z]/g, function (f) {
                        return f.toUpperCase();
                    });
                }
                h[pieces.join('-')] = rawHeaders[k];
            }
        }
        return h;
    }

    function headerHttpInterceptor($rootScope, $q) {

        return {
            request: function (config) {
                $rootScope.requestHeaders = standardizeHeaders(config, config.headers);
                return $q.when(config);
            },
            response: function (res) {
                $rootScope.responseHeaders = standardizeHeaders(res.config, res.headers());
                return $q.when(res);
            },
            responseError: function (res) {
                $rootScope.responseHeaders = standardizeHeaders(res.config, res.headers());
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