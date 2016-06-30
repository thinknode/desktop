/*
 * Watch Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */
module.exports = {
    target: {
        options: {
            atBegin: true,
            livereload: 35791
        },
        files: [
            'sass/**/*',
            'src/**/*',
            'templates/**/*'
        ],
        tasks: [
            'newer:preprocess:index',
            'newer:sass:dev',
            'newer:jshint:all'
        ]
    }
};