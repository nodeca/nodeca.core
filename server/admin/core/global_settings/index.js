'use strict';


function fetchGroupInfo(N, name) {
  let settingsCount = Object.values(N.config.setting_schemas.global)
                            .filter(x => x.group_key === name)
                            .length;

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

    for (let [ name, config ] of Object.entries(N.config.setting_groups)) {
      if (config.parent === null) {
        res.tabs.push({ name, priority: config.priority });
        res.groups[name] = [];
      }
    }

    res.tabs.sort((a, b) => a.priority - b.priority);

    res.tabs = res.tabs.map(x => x.name);

    //
    // Collect groups per tab.
    //

    for (let tab of res.tabs) {
      for (let [ name, config ] of Object.entries(N.config.setting_groups)) {
        if (tab === config.parent) {
          res.groups[tab].push(fetchGroupInfo(N, name));
        }
      }

      res.groups[tab].sort((a, b) => a.priority - b.priority);
    }
  });
};
