"use strict";


/*global nodeca*/


// stdlib
var format = require('util').format;


////////////////////////////////////////////////////////////////////////////////


// returns formatted suffix
function build_template(method, params, origin) {
  return format('%s(%s) via %s - %%s', method, JSON.stringify(params),
    (origin.realtime ? 'REALTIME' :
      ('HTTP ' + origin.http.req.method + ' ' + origin.http.req.url)));
}


////////////////////////////////////////////////////////////////////////////////


// Middleware that logs server requests and injects `env.extras.log(lvl, msg)`
// method for request logging
//
nodeca.filters.before('', {weight: -9900}, function log_requests(params, callback) {
  var logger    = nodeca.logger.getLogger('server.' + this.request.method),
      template  = build_template(this.request.method, params, this.origin);

  if (!this.extras.log) {
    this.extras.log = function (lvl, msg) {
      return logger[lvl](template, msg);
    };
  }

  this.extras.log('info', 'got request');
  callback();
});
