"use strict";


/*global nodeca*/


// stdlib
var format = require('util').format;


////////////////////////////////////////////////////////////////////////////////


// returns formatted suffix
function format_prefix(method, params, origin) {
  return format('%s(%s) via ', method, JSON.stringify(params)) +
    (origin.realtime ? 'REALTIME' :
      ('HTTP <' + origin.http.req.method + ' ' + origin.http.req.url + '>'));
}


////////////////////////////////////////////////////////////////////////////////


// Middleware that logs server requests and injects `env.extras.log(lvl, msg)`
// method for request logging
//
nodeca.filters.before('', {weight: -9900}, function log_requests(params, callback) {
  var logger = nodeca.logger.getLogger('server.' + this.request.method),
      prefix = format_prefix(this.request.method, params, this.origin);

  this.extras.log = function (lvl, msg) {
    logger[lvl](prefix + (msg ? ' - %s' : ''), msg);
  };

  logger.info(prefix);
  callback();
});
