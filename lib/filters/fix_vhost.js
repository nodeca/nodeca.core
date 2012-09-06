'use strict';


/*global nodeca*/


var LOCAL_IP_RE = /^(?:127|0)(?:\.\d{1,3}){3}(:\d+)?$/;


////////////////////////////////////////////////////////////////////////////////


// Filter middleware that interrupts request and sends redirect response with
// new `Location` to default host if `Host` of request is unknown.
//
nodeca.filters.before('', { weight: -900 }, function fix_vhost(params, callback) {
  var req = (this.origin.http || this.origin.rpc).req, host;

  if (LOCAL_IP_RE.exec(req.headers.host)) {
    // replace 0.0.0.0 and 127.*.*.* in hostname with `localhost`
    req.headers.host = 'localhost' + (RegExp.$1 || '');
  }

  // Temporarily stubbed out
  callback();
});
