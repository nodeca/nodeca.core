'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function global_settings_index(env) {
    var tabs     = env.response.data.tabs   = []
      , groups   = env.response.data.groups = {}
      , settings = N.config.setting_schemas['global'];

    // Collect tabs, i.e. groups without `parent`.
    _.forEach(N.config.setting_groups, function (tabConfig, tabName) {
      if (!tabConfig || !tabConfig.parent) {
        tabs.push(tabName);
        groups[tabName] = [];

        // Collect groups per tab.
        _.forEach(N.config.setting_groups, function (groupConfig, groupName) {
          if (groupConfig && groupConfig.parent === tabName) {
            groups[tabName].push({
              name: groupName
            , settingsCount: _.where(settings, { group_key: groupName }).length
            });
          }
        });
      }
    });

    env.response.data.activeTab = tabs[0];
  });
};
