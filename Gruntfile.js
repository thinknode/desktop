/*
 * Thinknode Explorer Gruntfile
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Grunt

module.exports = function(grunt) {
    'use strict';
    grunt.loadNpmTasks('grunt-electron-installer');

    // --------------------------------------------------
    // Configuration

    require('load-grunt-config')(grunt, {
        jitGrunt: {
            customTasksDir: 'tasks'
        },
        postProcess: function(config) {
            config.thinknode = {
                dev: grunt.option('dist') === true ? false : true
            };
        }
    });
};
