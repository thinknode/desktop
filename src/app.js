(function () {
    'use strict';

    var bluebird = require('bluebird');
    var _templateBase = './scripts';

    // Define module
    var app = angular.module('app', [
        '720kb.tooltips',
        'angularRipple',
        'base64',
        'ngAnimate',
        'ngRoute',
        'toastr',
        'ui.ace',
        'ui.router',
        'ngNotificationsBar',
        'angular-ladda'
    ]);

    // Configure module routes
    app.config([
        '$stateProvider',
        '$urlRouterProvider',
        '$httpProvider',
        'toastrConfig',
        'notificationsConfigProvider',
        'laddaProvider',
        function ($stateProvider, $urlRouterProvider, $httpProvider, toastrConfig, notificationsConfigProvider, ladda) {

            // Toastr customization
            angular.extend(toastrConfig, {
                extendedTimeOut: 5000,
                timeOut: 2000,
                tapToDismiss: true,
                allowHtml: true,
                closeButton: true
            });


            // --------------------------------------------------
            // Auth

            $stateProvider.state('auth', {
                abstract: true,
                templateUrl: './src/templates/auth.html',
                data: {
                    env: true
                }
            });

            $stateProvider.state('auth.select', {
                url: '/auth/select',
                templateUrl: './src/templates/auth.select.html',
                controller: 'authSelectController'
            });

            $stateProvider.state('auth.login', {
                url: '/auth/login?user&username&host',
                templateUrl: './src/templates/auth.login.html',
                controller: 'authLoginController',
                data: {
                    env: true
                }
            });

            // --------------------------------------------------
            // Explore

            $stateProvider.state('devkit', {
                abstract: true,
                templateUrl: './src/templates/root.html',
                controller: 'rootController',
                data: {
                    env: true,
                    session: true
                }
            });

            $stateProvider.state('devkit.api', {
                url: '/api',
                templateUrl: './src/templates/api.html',
                controller: 'apiController'
            });

            // --------------------------------------------------
            // Develop

            $stateProvider.state('devkit.apps', {
                url: '/develop/apps',
                templateUrl: './src/templates/develop.apps.html',
                controller: 'appsController',
                data: {
                    env: true,
                    session: true
                }
            });

            $stateProvider.state('devkit.app', {
                abstract: true,
                url: '/develop/apps/:app',
                templateUrl: './src/templates/develop.app.html',
                controller: 'appController',
                data: {
                    env: true,
                    session: true
                }
            });
            
            /*jslint todo: true */
            // TODO: Reimplement the app debug functionality. https://github.com/thinknode/desktop/issues/28
            /*$stateProvider.state('devkit.app.debug', {
                url: '/debug',
                templateUrl: './src/templates/develop.app.debug.html',
                controller: 'appDebugController'
            });*/

            $stateProvider.state('devkit.app.details', {
                url: '/details',
                templateUrl: './src/templates/develop.app.details.html',
                controller: 'appDetailsController',
                data: {
                    env: true,
                    session: true
                }
            });

            $stateProvider.state('devkit.app.definitions', {
                url: '/definitions/:cls',
                templateUrl: './src/templates/develop.app.definitions.html',
                controller: 'appDefinitionsController'
            });

            $stateProvider.state('devkit.app.dependencies', {
                url: '/dependencies',
                templateUrl: './src/templates/develop.app.dependencies.html',
                controller: 'appDependenciesController'
            });

            $stateProvider.state('devkit.app.provider', {
                url: '/provider',
                templateUrl: './src/templates/develop.app.provider.html',
                controller: 'appProviderController'
            });

            // --------------------------------------------------
            // Otherwise

            $urlRouterProvider.otherwise('/api');

            // --------------------------------------------------
            // Interceptor

            $httpProvider.interceptors.push('authInterceptor');
            $httpProvider.interceptors.push('headerHttpInterceptor');
            notificationsConfigProvider.setAcceptHTML(true);
            ladda.setOption({
                style: 'expand-right',
                spinnerSize: 20,
                spinnerColor: '#ffffff'
            });
        }
    ]);
    
    // --------------------------------------------------
    // App Constants
            
    app.constant('DOCS_URL','https://cdn.thinknode.com/docs');

    // Configure global event handlers
    app.run([
        '$rootScope',
        '$state',
        '$stateParams',
        'environment',
        'session',
        'storageProvider',
        function ($rootScope, $state, $stateParams, environment, session, storageProvider) {
            $rootScope.$state = $state;
            $rootScope.$stateParams = $stateParams;
            $rootScope.storage = storageProvider;
    
            $rootScope.$on('$stateChangeSuccess', function (event, toState, toParams) {
               
                var promises = [];
                
                // Initialize the environment and load the current session for routes that need it
                if (toState.data && toState.data.env) {
                    promises.push(environment.init());
                } else {
                    promises.push(bluebird.resolve());
                }
                if (toState.data && toState.data.session) {
                    promises.push(session.currentSession());
                } else {
                    promises.push(bluebird.resolve());
                }

                bluebird.all(promises).then(function () {
                    $rootScope.$emit('initialized');
                });
            });
        }]);

})();