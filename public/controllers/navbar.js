angular.module('MyApp')
  .controller('NavbarCtrl', ['$scope', 'Auth', function($scope, Auth) {
    $scope.logout = function() {
      console.log("inside NavbarCtrl");
      Auth.logout();
    };
  }]);
