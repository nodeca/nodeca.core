'use strict';

/*global nodeca*/

module.exports = function (params, next) {
  next();
};

nodeca.filters.before('@', function (params, next) {
  var data = this.response.data;
  var group_name = params.id;

  data.group_name = group_name;
  data.group = nodeca.settings.global.fetchSettingsByGroup(group_name);
  next();
});
