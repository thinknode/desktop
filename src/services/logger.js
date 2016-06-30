/*
 * Manifest Service
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Service

    function loggerService() {
        /* jshint validthis: true */

        this.logs = [];

        /**
         * @summary Appends a log message of a given type to the collection of logs.
         */
        this.append = function(type, message) {
            this.logs.push({
                "date": new Date(),
                "type": type,
                "message": message
            });
        };

        /**
         * @summary Clears the logs.
         */
        this.clear = function() {
            this.logs.length = 0;
        };
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register service

    angular.module('app').service('$logger', [loggerService]);
})();