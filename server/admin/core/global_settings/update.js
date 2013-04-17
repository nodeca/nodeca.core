'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    store: {
      type: 'string'
    , required: true
    }
  , settings: {
      type: 'object'
    , required: true
    }
  , params: {
      type: 'object'
    , required: false
    , 'default': {}
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    N.settings.set(env.params.store, env.params.settings, env.params.params, callback);
  });
};
