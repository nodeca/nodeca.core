'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    group: {
      type: 'string'
    , required: false
    }
  });

  N.wire.on(apiPath, function settings_global_show(env) {
    var rootGroups = env.response.data.rootGroups = [];

    _.forEach(N.config.setting_groups, function (config, name) {
      if (!config || !config.parent) {
        rootGroups.push(name);
      }
    });

    if (env.params.group) {
      env.response.data.activeGroup = env.params.group;
    } else {
      env.status = N.io.REDIRECT;
      env.headers['Location'] = N.runtime.router.linkTo(env.method, {
        group: rootGroups[0]
      });
    }
  });
};
