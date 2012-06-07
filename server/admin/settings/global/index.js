'use strict';

/*global nodeca*/

var NLib = require('nlib');

var _ = NLib.Vendor.Underscore;

module.exports = function (params, next) {
  next();
};

nodeca.filters.before('@', function (params, next) {
  var data = this.response.data;
  data.groups = [];
  nodeca.settings.global.getGroups().forEach(function(group){
    data.groups.push(group);
  });
  next();
});

