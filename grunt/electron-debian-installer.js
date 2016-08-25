/*
 * Electron Debian Installer Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports = {
    'electron-debian-installer': {
        src: './artifacts/Thinknode-linux-x64',
        dest: './artifacts/',
        options: {
            name: "thinknode",
            productName: "Thinknode",
            genericName: "Thinknode",
            version: "1.3.0",
            productDescription: "Desktop application for exploring and interacting with the Thinknode API",
            description: "Desktop application for exploring and interacting with the Thinknode API",
            bin: 'Thinknode',
            arch: 'amd64',
            icon: "assets/linux/icon.png",
            rename: function (dest, src) {
                return dest + '<%= name %>-<%= version %>.<%= arch %>.deb';
            },
            categories: [
                'Utility'
            ]
        }
    }
};
