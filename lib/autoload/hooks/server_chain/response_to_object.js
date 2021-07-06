// Convert output data to plain objects, to avoid type casting in templates.
// Currently required only for mongoose `ObjectId` -> String.
//
// (!) Now listen only `http` requests, because on `rpc` data is autocasted
// by json serialization. If nothing changes, this can be moved directly
// to http responder chain
//

'use strict';


const ObjectId = require('mongoose').Types.ObjectId;


function objectify(hash) {
  for (let [ key, val ] of Object.entries(hash)) {

    if (val && (typeof val === 'object')) {
      if (val instanceof ObjectId) {
        hash[key] = val.toString();
        continue;
      }
      // Don't check Date & Regexp - that's faster.
      objectify(val);
      continue;
    }

    if (Array.isArray(val)) {
      objectify(val);
      continue;
    }
  }
}

module.exports = function (N) {

  N.wire.after('server_chain:http:*', { priority: 100 }, function response_to_plain_object(env) {
    objectify(env.res);
  });
};
