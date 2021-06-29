'use strict';


const _ = require('lodash');


function fetchGroupInfo(N, name) {
  let settingsCount = _.filter(N.config.setting_schemas.global, {
    group_key: name
  }).length;

  return { name, settingsCount };
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function global_settings_index(env) {
    let res = env.res;

    res.head.title = env.t('title');

    res.tabs   = [];
    res.groups = {};

    //
    // Collect tabs, i.e. groups without `parent`.
    //

    _.forEach(N.config.setting_groups, (config, name) => {
      if (config.parent === null) {
        res.tabs.push({ name, priority: config.priority });
        res.groups[name] = [];
      }
    });

    res.tabs.sort((a, b) => a.priority - b.priority);

    res.tabs = res.tabs.map(x => x.name);

    //
    // Collect groups per tab.
    //

    _.forEach(res.tabs, tab => {
      _.forEach(N.config.setting_groups, (config, name) => {
        if (tab === config.parent) {
          res.groups[tab].push(fetchGroupInfo(N, name));
        }
      });

      res.groups[tab].sort((a, b) => a.priority - b.priority);
    });
  });
};
