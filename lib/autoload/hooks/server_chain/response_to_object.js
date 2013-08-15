// Convert output data to plain object. Mostly required
// for mongoose `ObjectId` -> String. What allows to simplify template files.

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
    env.extras.puncher.start('Converting data to plain object');

    objectify(env.response);

    env.extras.puncher.stop();
  });
};