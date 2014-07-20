// Refuses session if client IP address not matches one saved in session data.
// It matches addresses for only first three octets, i.e. by 255.255.255.0 mask.
//
// NOTE: IPv6 are not actually supported but it will work with full match.


'use strict';


var _ = require('lodash');


var MATCH_IPV4_OCTETS = 3; // 255.255.255.0 mask
var MATCH_IPV6_OCTETS = 7; // FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:0000 mask

var SPLIT_RE = /[.:]/;

module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -75 }, function session_ip_check(env) {
    if (!env.session) {
      return;
    }

    if (!_.has(env.session, 'ip')) {
      // Session was created before this hook came added/enabled.
      // So it is not binded to any address to check yet.
      return;
    }

    var match_len = env.req.ip.indexOf(':') !== -1 ? MATCH_IPV6_OCTETS : MATCH_IPV4_OCTETS;

    var requestAddressOctets = _.first(env.req.ip.split(SPLIT_RE), match_len)
      , sessionAddressOctets = _.first(env.session.ip.split(SPLIT_RE), match_len);

    // Most simple and fast way to compare octet arrays
    if ((requestAddressOctets.join('.') === sessionAddressOctets.join('.')) &&
        (env.req.ip.length === env.session.ip.length) &&
        (requestAddressOctets.length > 1)) { // make sure split really happened
      // Addresses match - do nothing.
      return;
    }

    // Reject session.
    env.session = null;
  });


  N.wire.before('server_chain:*', { priority: -65 }, function session_ip_set(env) {
    if (!env.session) {
      return;
    }

    env.session.ip = env.req.ip;
  });
};
