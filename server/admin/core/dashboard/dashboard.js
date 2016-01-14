'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function dashboard(env) {
    env.res.head.title = env.t('title');
  });
};
