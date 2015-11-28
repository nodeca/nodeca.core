'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  setInterval(function () {
    N.live.emit('admin.ping', {});
  }, 1000);

  N.wire.on(apiPath, function dashboard(env, next) {
    env.res.head.title = env.t('title');
    next();
  });
};
