/*
 * Newer Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

var fs = require('fs');
var fspath = require('path');

function checkForModifiedSass(path, time, include) {
    var items = fs.readdirSync(path);
    for (var i = 0; i < items.length; ++i) {
        var filename = items[i];
        var filepath = fspath.join(path, filename);
        var stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            if (checkForModifiedSass(filepath, time, include)) {
                return true;
            }
        } else {
            var ext = fspath.extname(filename);
            if (ext === '.scss' && stats.mtime.getTime() >= time) {
                return true;
            }
        }
    }
    return false;
}

module.exports = {
    options: {
        override: function(detail, include) {
            if (detail.task === 'sass') {
                var path = fspath.dirname(detail.path);
                if (checkForModifiedSass(path, detail.time.getTime())) {
                    include(true);
                } else {
                    include(false);
                }
            } else {
                include(false);
            }
        }
    }
};