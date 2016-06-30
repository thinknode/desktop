/*
 * Authorization Factory
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Factory

    function authInterceptor($q, $location) {
        return {
            response: function(response) {
                return response;
            },
            responseError: function(response) {
                if (response.status === 401) {
                    $location.path('/auth/select');
                }
                return $q.reject(response);
            }
        };
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register factory

    angular.module('app').factory('authInterceptor', ['$q', '$location', authInterceptor]);
})();