/*
 * Preprocess Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports = {
    index: {
        src: 'src/index.html',
        dest: 'index.html',
        options: {
            context: {
                "DEV": true
            },
            inline: false
        }
    },
    main: {
        src: 'main.js',
        dest: 'artifacts/build/main.js',
        options: {
            context: {
                "DEV": false
            },
            inline: false
        }
    },
    html: {
        src: 'src/index.html',
        dest: 'artifacts/build/index.html',
        options: {
            context: {
                "DEV": false
            },
            inline: false
        }
    },
    "menu": {
        src: 'src/templates/root.html',
        dest: 'artifacts/build/src/templates/root.html',
        options: {
            context: {
                "DEV": false
            },
            inline: false
        }
    }
};