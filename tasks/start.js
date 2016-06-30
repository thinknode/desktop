/*
 * Start Task
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports = function(grunt) {

    /**
     * @summary Starts the electron application.
     * @description
     * This task is responsible for starting the electron application while simultaneously
     * watching for changes to the source files that should cause a live reload.
     */
    grunt.registerTask('start', 'Starts the electron application.', function() {
        grunt.task.run('preprocess:index', 'concurrent:start');
    });
};