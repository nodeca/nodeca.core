// Try to load timezone offset from cookies (if available)

'use strict';


module.exports = function (N) {

  N.wire.before([ 'responder:http', 'responder:rpc' ], { priority: -4 }, function tz_offset_read(env) {

    if (typeof env.extras.getCookie('tz') === 'undefined') { return; }

    var tzOffset = parseInt(env.extras.getCookie('tz'), 10);

    if (isNaN(tzOffset) || Math.abs(tzOffset) > 24 * 60) { return; }

    env.req.tzOffset = tzOffset;
  });
};
