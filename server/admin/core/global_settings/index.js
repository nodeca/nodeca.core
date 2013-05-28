'use strict';


var _ = require('lodash');


function fetchGroupInfo(name) {
  var settingsCount = _.where(N.config.setting_schemas['global'], {
    group_key: name
  }).length;

  return { name: name, settingsCount: settingsCount };
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function global_settings_index(env) {
    var data = env.response.data;

    data.head.title = env.t('title');

    data.tabs   = [];
    data.groups = {};

    //
    // Collect tabs, i.e. groups without `parent`.
    //

    _.forEach(N.config.setting_groups, function (config, name) {
      if (null === config.parent) {
        data.tabs.push({ name: name, priority: config.priority });
        data.groups[name] = [];
      }
    });

    data.tabs.sort(function (a, b) {
      return a.priority - b.priority;
    });

    data.tabs = _.pluck(data.tabs, 'name');

    //
    // Collect groups per tab.
    //

    _.forEach(data.tabs, function (tab) {
      _.forEach(N.config.setting_groups, function (config, name) {
        if (tab === config.parent) {
          data.groups[tab].push(fetchGroupInfo(name));
        }
      });

      data.groups[tab].sort(function (a, b) {
        return a.priority - b.priority;
      });
    });
  });
};
