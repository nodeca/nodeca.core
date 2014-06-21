// Refuses session if client IP address not matches one saved in session data.
// It matches addresses for only first three octets, i.e. by 255.255.255.0 mask.
//
// NOTE: IPv6 are not actually supported but it will work with full match.


'use strict';


var _ = require('lodash');


var MATCH_OCTETS_COUNT = 3; // 255.255.255.0 mask.


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

    var requestAddressOctets = _.first(env.req.ip.split('.'), MATCH_OCTETS_COUNT)
      , sessionAddressOctets = _.first(env.session.ip.split('.'), MATCH_OCTETS_COUNT);

    // Most simple way to compare these arrays. _.isEqual is too complex.
    if (requestAddressOctets.join('.') === sessionAddressOctets.join('.')) {
      // Addresses match - do nothing.
      return;
    }

    // Refuse session.
    env.session = null;
  });


  N.wire.before('server_chain:*', { priority: -65 }, function session_ip_set(env) {
    if (!env.session) {
      return;
    }

    env.session.ip = env.req.ip;
  });
};
