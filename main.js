var app = require('app'); // Module to control application life.
var BrowserWindow = require('browser-window'); // Module to create native browser window.
var Menu = require("menu");
var menuTemplate = require('./src/electron/menuTemplate');
var config = require('./src/electron/config');
var Config = new config(app);
//var updater = require('auto-updater');

// Report crashes to our server.
require('crash-reporter').start({
    productName: 'Thinknode',
    companyName: 'Thinknode Labs, LLC',
    submitURL: 'https://thinknode.com',
    autoSubmit: false
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

// Handle any attempts to open a second instance.
var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
    return true;
});

if (shouldQuit) {
    app.quit();
    return;
}

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {

    // Create the browser window.
    var config = Config.getConfig();
    var bounds = config.bounds || {};
    mainWindow = new BrowserWindow({
        "width": bounds.width || 1024,
        "height": bounds.height || 768,
        "minWidth": 1024,
        "minHeight": 768,
        "icon": "./assets/linux/icon.png"
    });

    // and load the index.html of the app.
    var page = 'file://' + __dirname + '/index.html#';
    if(typeof config.lastPage === "string") {
        page += config.lastPage;
    }
    mainWindow.loadURL(page);

    // @ifdef DEV=TRUE
    // Open the DevTools.
    mainWindow.openDevTools();
    // @endif

    mainWindow.on('close', function() {
        var url = mainWindow.webContents.getURL();
        // Get size of window before closing and set config, this needs to happen synchronously
        Config.setConfig('bounds', mainWindow.getBounds());

        // Set route they were last on from URL
        Config.setConfig('lastPage', url.substring(url.indexOf('#')+2));
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    if (process.argv[2] !== "debug") {
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    }
});

// This handles installing desktop icons and start menu shortcuts
if (require('electron-squirrel-startup')) return;
