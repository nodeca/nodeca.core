'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    settings: {
      type: 'object'
    , required: true
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    N.settings.set('global', env.params.settings, {}, callback);
  });
};
