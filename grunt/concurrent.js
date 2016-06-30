/*
 * Concurrent Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports = {
    start: {
        tasks: ['exec', 'watch'],
        options: {
            logConcurrentOutput: true
        }
    }
};