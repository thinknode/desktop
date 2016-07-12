(function() {
    'use strict';

    var _templateBase = './scripts';

    // Define module
    var app = angular.module('app', [
        '720kb.tooltips',
        'angularRipple',
        'app.environment',
        'app.session',
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
        '$sessionProvider',
        '$environmentProvider',
        '$httpProvider',
        'toastrConfig',
        'notificationsConfigProvider',
        'laddaProvider',
        function($stateProvider, $urlRouterProvider, $sessionProvider, $environmentProvider, $httpProvider, toastrConfig, notificationsConfigProvider, ladda) {

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
                resolve: {
                    env: $environmentProvider.init
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
                resolve: {
                    env: $environmentProvider.init
                }
            });

            // --------------------------------------------------
            // Explore

            $stateProvider.state('devkit', {
                abstract: true,
                templateUrl: './src/templates/root.html',
                controller: 'rootController',
                resolve: {
                    session: $sessionProvider.currentSession,
                    env: $environmentProvider.init
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
                resolve: {
                    session: $sessionProvider.currentSession,
                    env: $environmentProvider.init
                }
            });

            $stateProvider.state('devkit.app', {
                abstract: true,
                url: '/develop/apps/:app',
                templateUrl: './src/templates/develop.app.html',
                controller: 'appController',
                resolve: {
                    session: $sessionProvider.currentSession,
                    env: $environmentProvider.init
                }
            });

            $stateProvider.state('devkit.app.debug', {
                url: '/debug',
                templateUrl: './src/templates/develop.app.debug.html',
                controller: 'appDebugController'
            });

            $stateProvider.state('devkit.app.details', {
                url: '/details',
                templateUrl: './src/templates/develop.app.details.html',
                controller: 'appDetailsController',
                resolve: {
                    session: $sessionProvider.currentSession,
                    env: $environmentProvider.init
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

    // Configure global event handlers
    app.run(['$rootScope', '$state', '$stateParams', function($rootScope, $state, $stateParams) {
        $rootScope.$state = $state;
        $rootScope.$stateParams = $stateParams;

        $rootScope.$on('$stateChangeError', function(e, to, toParams, from, fromParams, err) {
            //console.log("$stateChangeError", err, to, from);
            // $state.go('auth.select');
        });
    }]);
    // app.run(['$location', '$rootScope', function($location, $rootScope) {

    //     $location.path('/login');

    //     $rootScope.$on('$routeChangeSuccess', function(e, curr, prev, err) {
    //         console.log("$routeChangeSuccess", curr, prev);
    //         // $rootScope.initialized = true;
    //     });



    //     // // console.log($rootScope.path);
    //     // $rootScope.path = function(url) {
    //     //     $location.path(url);
    //     // };
    // }]);
})();