// Process errors, if happens.
// AND make default answer (for http)
//

'use strict';


var http = require('http');
var _    = require('lodash');


var DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8';


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.after(['responder:http', 'responder:rpc'], { priority: 50 }, function error_process(env) {
    var err = env.err;

    if (!err) {
      return;
    }

    // Extend sugared errors
    // Example: next(404);
    if (err === +err) {
      env.body = '[' + err + '] ' + http.STATUS_CODES[err];
      err = env.err = { code: env.err };
    }


    if (err.code) {
      env.status = err.code;

      if (200 <= err.code && err.code < 400) {
        // Just extend existing headers on non-error code.
        env.headers = _.extend({ 'Content-Type': DEFAULT_CONTENT_TYPE }, env.headers, err.head);
      } else {
        // Full replace of existing headers on *error* code.
        env.headers = _.extend({ 'Content-Type': DEFAULT_CONTENT_TYPE }, err.head);
      }

      if (err.data && 'object' === typeof err.data) {
        env.body = JSON.stringify(err.data);
      } else {
        env.body = err.message || '[' + err.code + '] ' + http.STATUS_CODES[err.code];
      }

      return;
    }

    // Still no code -> we got Error object
    // Example: next(new Error('Fatal fuckup'))
    err = {
      code: N.io.APP_ERROR,
      data: err.stack || err.message || err.toString()
    };
    env.status = err.code;
    env.headers = { 'Content-Type': DEFAULT_CONTENT_TYPE };

    if ('development' === N.runtime.env) {
      env.body = err.data;
    } else {
      env.body = '[500] Internal Server Error';
    }
  });
};
