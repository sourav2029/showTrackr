angular.module('MyApp')
  .controller('SignupCtrl', ['$scope', 'Auth', function($scope, Auth) {
    $scope.signup = function() {
        console.log("inside SignupCtrl");
      Auth.signup({
        email: $scope.email,
        password: $scope.password
      });
    };
  }]);
