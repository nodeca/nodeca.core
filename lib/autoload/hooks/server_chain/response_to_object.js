// Convert output data to plain objects, to avoid type casting in templates.
// Currently required only for mongoose `ObjectId` -> String.
//
// (!) Now listen only `http` requests, because on `rpc` data is autocasted
// by json serialization. If nothing changes, this can be moved directly
// to http responder chain
//

'use strict';

var _ = require('lodash');
var ObjectId = require('mongoose').Types.ObjectId;

function objectify(hash) {
  _.forEach(hash, function (val, key) {

    if (val && ((typeof val) === 'object')) {
      if (val instanceof ObjectId) {
        hash[key] = val.toString();
        return;
      }
      // Don't check Date & Regexp - that's faster.
      objectify(val);
      return;
    }

    if (Array.isArray(val)) {
      objectify(val);
      return;
    }
  });
}

module.exports = function (N) {

  N.wire.after('server_chain:http:*', { priority: 100 }, function response_to_plain_object(env) {
    env.extras.puncher.start('convert data to plain object');

    objectify(env.res);

    env.extras.puncher.stop();
  });
};