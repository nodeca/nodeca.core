'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    settings: {
      type: 'object'
    , required: true
    }
  });


  N.wire.on(apiPath, function global_settings_update(env, callback) {
    var settings = {};

    _.forEach(env.params.settings, function (value, name) {
      settings[name] = { value: value };
    });

    N.settings.set('global', settings, {}, function (err) {
      if (err) {
        callback({ code: N.io.BAD_REQUEST, message: String(err) });
        return;
      }

      callback();
    });
  });
};
