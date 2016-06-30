/*
 * Sass Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports = {
    dev: {
        files: {
            'assets/css/styles.css': 'sass/styles.scss'
        }
    },
    dist: {
        options: {
            sourcemap: 'none',
            style: 'compact'
        },
        files: {
            'assets/css/styles.css': 'sass/styles.scss'
        }
    }
};