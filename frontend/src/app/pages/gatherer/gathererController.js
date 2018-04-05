(function () {
  'use strict';

  angular.module('BlurAdmin.pages.gatherer')
    .controller('gathererController', gathererController);

  /** @ngInject */
  function gathererController($scope, $rootScope, $http, $timeout, $polling, $q, localStorageService, toastr, toastrConfig) {
    console.log('Initialize Controller');

    // Notifications
    var defaultConfig = angular.copy(toastrConfig);
    var openedToasts = [];
    $scope.options = {
      autoDismiss: false,
      positionClass: 'toast-top-right',
      type: 'info',
      timeOut: '1500',
      extendedTimeOut: '2000',
      allowHtml: false,
      closeButton: false,
      tapToDismiss: true,
      progressBar: false,
      newestOnTop: false,
      maxOpened: 0,
      preventDuplicates: false,
      preventOpenDuplicates: false
    };
    angular.extend(toastrConfig, $scope.options);

    $scope.tasks = new Array();
     
    // Do something if not
    if(localStorageService.isSupported) {
        console.log("localStorage Supported");
    }

    // Control storage
    if (localStorageService.get('button-off')) {
        $scope.button = localStorageService.get('button-off');
    }
    if (localStorageService.get('emailAddress')) {
        $scope.emailAddress = localStorageService.get('emailAddress');
    }
    if (localStorageService.get('gather')) {
        $scope.gather = localStorageService.get('gather');
    } else {
        $scope.gather = new Object();
    }

    $scope.clearInfo = function () {
        // Aniquilate everything
        localStorageService.remove('button-off');
        localStorageService.remove('gather');
        localStorageService.remove('emailAddress');
        delete $scope.button;
        delete $scope.gather;
        delete $scope.emailAddress;
        delete $scope.username;
        delete $scope.tasks;
        $scope.tasks = new Array();
    }

    $scope.showInfo = function (address) {

        // Verify Adress
        $scope.emailAddress = address;
        localStorageService.set('emailAddress', address);
        $scope.username = $scope.emailAddress.split("@")[0];
        $rootScope.emailAddress = address;
        $rootScope.username = $scope.emailAddress.split("@")[0];
        $scope.button = 'OFF';
        localStorageService.set('button-off', 'OFF');

        //////////////////////////////////////////////////
        // Testing
        //////////////////////////////////////////////////
        console.log("Execute Testing");
        $http.post('http://127.0.0.1:5000/testing', {testing: "ok", username: $scope.username});

        //////////////////////////////////////////////////
        // Fullcontact data
        //////////////////////////////////////////////////
        console.log("Execute Fullcontact");
        $http.post('http://127.0.0.1:5000/fullcontact', {username: $scope.username})
            .success(function (data, status, headers, config) {
                $scope.tasks.push({
                    "module" : data.module, "param" : data.param,
                    "task_id" : data.task, "state" : "PENDING",
                });
                openedToasts.push(toastr['info']("", "Initial Gather"));
                $polling.startPolling(data.module, 'http://127.0.0.1:5000/state/' + data.task + '/' +  data.module, 1000, callbackProccessData);

            });

        //////////////////////////////////////////////////
        // GitHub data
        //////////////////////////////////////////////////
        // console.log("Execute Github");
        // $http.post('http://127.0.0.1:5000/github', {username: $scope.username})
        //     .success(function (data, status, headers, config) {
        //         $scope.tasks.push({
        //             "module" : data.module, "param" : data.param,
        //             "task_id" : data.task, "state" : "PENDING",
        //         });
        //         openedToasts.push(toastr['info']("", "Github"));
        //         $polling.startPolling(data.module, 'http://127.0.0.1:5000/state/' + data.task + '/' +  data.module, 1000, callbackProccessData);

        //     });

        
        //////////////////////////////////////////////////
        // Callback 
        //////////////////////////////////////////////////
        // Progress bar
        var progressTotal = 0
        var progressChunk = 0
        var progressActual = 0
        $('#progress-gather').css('width', '0%').attr('aria-valuenow', '0');

        // Process data result
        function callbackProccessData(response) {
            if (response.data.state == "SUCCESS"){
                openedToasts.push(toastr['success']("", response.data.task_app));
                $polling.stopPolling(response.data.task_app);

                $http.get('http://127.0.0.1:5000/result/' + response.data.task_id)
                .success(function (data, status, headers, config) {
                    for (var items in data.result) {

                        if (data.result[items].profile != null) {
                            if ($scope.profile == null) { $scope.profile = new Object(); }
                            $scope.profile[response.data.task_app] = data.result[items].profile;
                            console.log("Profile ", $scope.profile);
                            localStorageService.set('profile', $scope.profile);
                        }

                        if (data.result[items].timeline != null) {
                            if ($scope.timeline == null) { $scope.timeline = []; }
                                for (var i in data.result[items].timeline) {
                                    $scope.timeline.push(data.result[items].timeline[i]);
                                }
                            console.log("Timeline ", $scope.timeline);
                            localStorageService.set('timeline', $scope.timeline);
                        }

                        if (data.result[items].tasks != null) {
                            for (var run in data.result[items].tasks) {
                                console.log("Execute ", data.result[items].tasks[run].module);
                                $http.post('http://127.0.0.1:5000/' + data.result[items].tasks[run].module, {username: data.result[items].tasks[run].param})
                                    .success(function (data, status, headers, config) {
                                        $scope.tasks.push({
                                            "module" : data.module, "param" : data.param,
                                            "task_id" : data.task, "state" : "PENDING",
                                        });
                                        openedToasts.push(toastr['info']("", data.module));
                                        $polling.startPolling(data.module, 'http://127.0.0.1:5000/state/' + data.task + '/' +  data.module, 1000, callbackProccessData);
                                    });
                            }
                        }

                    }

                    if ($scope.gather == null) { $scope.gather = new Object(); }
                    $scope.gather[response.data.task_app] = data;
                    localStorageService.set('gather', $scope.gather);
                    console.log('Gather', $scope.gather);
                    console.log('Task', $scope.tasks);
                   

                    // Code for progress bar
                    progressActual = progressActual + progressChunk;
                    $('#progress-gather').css('width', progressActual+'%').attr('aria-valuenow', progressActual);
                    console.log(progressTotal, progressChunk, progressActual);

                });
            }
        };

        // Wait to task begin
        // $q.all([r_gitlab, r_keybase]).then(function() {
        //     $scope.gather = new Object();
        //     // var task;
        //     for (var task in $scope.tasks) {
        //         console.log("Task ", $scope.tasks[task].task_id, $scope.tasks[task].module)
        //         $polling.startPolling($scope.tasks[task].module, 'http://127.0.0.1:5000/state/' + $scope.tasks[task].task_id + '/' +  $scope.tasks[task].module, 1000, callbackProccessData);

        //     // Progress bar
        //     progressTotal = $scope.tasks.length;
        //     progressChunk = 100 / progressTotal;
        //     console.log(progressTotal, progressChunk, progressActual);
        //     };
        // });



    }

  }


})();