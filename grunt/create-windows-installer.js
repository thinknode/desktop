/*
 * Electron Windows Installer Configuration
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

module.exports =  {
    ia32: {
        appDirectory: './artifacts/Thinknode-win32-ia32/',
        outputDirectory: './artifacts/windows/ia32/',
        exe: 'Thinknode.exe',
        setupIcon: './assets/win/icon.ico',
        iconUrl: 'http://thinknode.com/favicon.ico',
        author: "Thinknode",
        version: "1.4.2",
        title: "Thinknode",
        certificateFile: 'C:\\thinknode\\code_signing.p12',
        certificatePassword: '',
        description: "Client application for exploring and interacting with the Thinknode API",
        loadingGif: "./assets/win/installer.gif",
        noMsi: true
    },
    x64: {
        appDirectory: './artifacts/Thinknode-win32-x64/',
        outputDirectory: './artifacts/windows/x64/',
        exe: 'Thinknode.exe',
        setupIcon: './assets/win/icon.ico',
        iconUrl: 'http://thinknode.com/favicon.ico',
        author: "Thinknode",
        version: "1.4.2",
        title: "Thinknode",
        certificateFile: 'C:\\thinknode\\code_signing.p12',
        certificatePassword: '',
        description: "Client application for exploring and interacting with the Thinknode API",
        loadingGif: "./assets/win/installer.gif",
        noMsi: true
    }
};
