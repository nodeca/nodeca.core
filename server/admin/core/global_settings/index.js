'use strict';


var _ = require('lodash');


function fetchGroupInfo(N, name) {
  var settingsCount = _.filter(N.config.setting_schemas.global, {
    group_key: name
  }).length;

  return { name: name, settingsCount: settingsCount };
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function global_settings_index(env) {
    var res = env.res;

    res.head.title = env.t('title');

    res.tabs   = [];
    res.groups = {};

    //
    // Collect tabs, i.e. groups without `parent`.
    //

    _.forEach(N.config.setting_groups, function (config, name) {
      if (config.parent === null) {
        res.tabs.push({ name: name, priority: config.priority });
        res.groups[name] = [];
      }
    });

    res.tabs.sort(function (a, b) {
      return a.priority - b.priority;
    });

    res.tabs = _.map(res.tabs, 'name');

    //
    // Collect groups per tab.
    //

    _.forEach(res.tabs, function (tab) {
      _.forEach(N.config.setting_groups, function (config, name) {
        if (tab === config.parent) {
          res.groups[tab].push(fetchGroupInfo(N, name));
        }
      });

      res.groups[tab].sort(function (a, b) {
        return a.priority - b.priority;
      });
    });
  });
};
