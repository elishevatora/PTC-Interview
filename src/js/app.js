let ptcApp = angular.module('ptcApp', ['ngMaterial', 'ngMaterialDateRangePicker',]);

//service to manage the loader state 
ptcApp.factory('loadingService', function () {
    var service = {
        requestCount: 0,
        isLoading: function () {
            return service.requestCount > 0;
        }
    };
    return service;
});

//Component that displays the datepicker and updates the parent with the chosen values
ptcApp.controller('datePicker', function ($scope, $mdDateRangePicker) {

    var tempDate = new Date("2020-09-06");
    tempDate.setDate(tempDate.getDate() - 60);

    $scope.isFutureDate = function (d) {
        var date = d.$date ? d.$date : d;
        return date && date.getTime() > new Date().getTime();
    }

    $scope.mdCustomTemplates = [{
        name: 'Last 30 Days',
        dateStart: new Date(tempDate),
        dateEnd: new Date('2020-09-06')
    }];

    $scope.selectedRange = {
        selectedTemplate: 'Last 30 Days',
        selectedTemplateName: 'Last 30 Days',
        dateStart: new Date(tempDate),
        dateEnd: new Date(),
        showTemplate: true,
        firstDayOfWeek: 0,
        customTemplates: $scope.mdCustomTemplates,
        isDisabledDate: $scope.isFutureDate
    };

    $scope.selectDateRange = function () {
        $mdDateRangePicker.show({
            model: $scope.selectedRange,
        }).then(function (result) {
            $scope.$parent.pickerModel={start:moment(result.dateStart),end:moment(result.dateEnd)}
            $scope.$parent.filter()
        }).catch(function () {
            console.log('Cancelled');
        });
    }


});

//Component of the loader that updates itself according to the service status
ptcApp.controller('LoadingCtrl', function ($scope, loadingService) {
    $scope.$watch(function () {
        return loadingService.isLoading();
    }, function (value) {
        $scope.loading = value;
    });
});

//Main component of the application
ptcApp.controller('listofStateCtrl', function ($scope, $http, loadingService) {
    //Date selected by the user
    $scope.pickerModel = null;
    //contains data retrieved via the api (not processed)
    $scope.data = null;
    $scope.typeToDisplay = "Deaths";
    //state selected in the sidebar
    $scope.states = [];
    $scope.selectValue = ["Active", "Deaths", "Recovered", "Confirmed"];
    $scope.chartConfig = {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: $scope.typeToDisplay
            },

        }
    };


    //collect the data from the api
    $scope.getRequest = function () {
        //manage state of the loader..
        loadingService.requestCount++;

        $http.get("https://api.rootnet.in/covid19-in/unofficial/covid19india.org/statewise/history")
            .then(
                function successCallback(response) {
                    loadingService.requestCount--;
                    //store the data in the componenets
                    $scope.data = response.data.data;
                    
                    $scope.fillData();
                    $scope.fillState();

                },
                function errorCallback(response) {
                    console.log("Unable to perform get request");
                }
            );
    };
    //we transform the received data into the desired type
    //here we just transform the date in moment object
    $scope.fillData = function () {
        $scope.data.history.forEach(x => {
            x.day = new moment(x.day, "YYYY-MM-DD")
        })
    }


    //browse the api to get all possible states (for the sidebar) being careful not to have duplicates 
    $scope.fillState = function () {
        //use of set for duplicates
        var state = new Set();
        $scope.data.history.forEach(history => {
            state = new Set([...state, ...history.statewise.map(x => x.state)])
        });
        $scope.states = [...state].map(x => {
            return {
                state: x,
                selected: false
            }
        });

        $scope.filter();

    };
    //Processing of data to be displayed on the graph
    $scope.filter = function () {
        let data = {
            labels: [],
            datasets: []
        }

        let filteredData;
        //We start to check if the user has chosen a date
        if ($scope.pickerModel) {
            //If yes, we filter according to the range
            filteredData = $scope.data.history.filter(x => x.day > $scope.pickerModel.start && x
                .day < $scope.pickerModel.end);
        } else {
            //If not we take the first day of each month not to have too much to give
            filteredData = $scope.data.history.filter(x => x.day.date() == 1)
        }
        //We check afterwards if states are selected
        if ($scope.states.filter(x => x.selected).length > 0) {
            let selectionnedState = $scope.states.filter(x => x.selected).map(x => x.state);
            $scope.labels = [];
            $scope.series = [];
            $scope.dataChart = [];

            //We add each dataset 
            //A dataset and give them sorted by status per day contained in the variable filteredData
            selectionnedState.forEach(state => {
                let currentStateDate = filteredData.map(x => {
                    let statewi = x.statewise[x.statewise.findIndex(c => c.state.includes(state))];
                    return {
                        day: x.day,
                        type: statewi ? statewi[$scope.typeToDisplay.toLowerCase()] : 0
                    }
                })
                data.datasets.push({
                    label: state,
                    backgroundColor: namedColor(state.length),
                    borderColor: namedColor(state.length),
                    fill: false,
                    data: currentStateDate.map(c => c.type),

                })
                //The labels are always the same so they are only added at the first iteration
                if (data.labels.length == 0) {
                    data.labels = currentStateDate.map(x => x.day.format("MM-DD-YY"));
                }
            })

        } else {
            //Display of Global state data if any state is selected
            let sdata = filteredData.map(x => {
                return {
                    day: x.day,
                    type: x.total[$scope.typeToDisplay.toLowerCase()]
                }
            })
            $scope.labels = sdata.map(x => x.day.format("MM DD YY"));
            data.labels = sdata.map(x => x.day.format("MM DD YY"));
            data.datasets.push({
                label: 'All State',
                backgroundColor: window.chartColors.blue,
                borderColor: window.chartColors.blue,
                fill: false,
                data: sdata.map(x => x.type),

            })
        }

        //Update of the graph with the new data
        $scope.chartConfig.data = data;
        $scope.chartConfig.options.title.text = $scope.typeToDisplay;
        if ($scope.myLine) {
            $scope.myLine.update()
        } else {
            var ctx = document.getElementById('canvas').getContext('2d');
            $scope.myLine = new Chart(ctx, $scope.chartConfig);
        }
    }





    this.$onInit = function () {
        $scope.getRequest()
    }
});




//chartUtils
//retrieve from chart.js library to have random colors
const CHART_COLORS = {
    red: 'rgb(255, 99, 132)',
    orange: 'rgb(255, 159, 64)',
    yellow: 'rgb(255, 205, 86)',
    green: 'rgb(75, 192, 192)',
    blue: 'rgb(54, 162, 235)',
    purple: 'rgb(153, 102, 255)',
    grey: 'rgb(201, 203, 207)'
};

const NAMED_COLORS = [
    CHART_COLORS.red,
    CHART_COLORS.orange,
    CHART_COLORS.yellow,
    CHART_COLORS.green,
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.grey,
];

function namedColor(index) {
    return NAMED_COLORS[index % NAMED_COLORS.length];
}