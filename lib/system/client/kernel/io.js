/**
 *  io
 *
 *  This module provides realtime communication methods for Nodeca.
 **/
'use strict';


const _     = require('lodash');
// IO status/error codes used by RPC and HTTP servers.
const codes = require('../../io');


// local alias to N
let N;
let requests = [];


// Define custom error classes
//
function RPCError() {}
RPCError.prototype = Object.create(Error.prototype);

function CancellationError() {}
CancellationError.prototype = Object.create(Error.prototype);


// rpc(name, [params], [options]) -> Promise
//
// Returned promise extended with `.cancel()` that allow abort XHR request.
//
// Options:
//
// - persistent - optional, do not terminate request by `navigate.exit`, default `false`
//
// Example:
//
//   rpc('core.test')
//     .then(response => { /*...*/ })
//     .catch(err => {
//       if (err.code !== N.io.CLIENT_ERROR) throw err;
//       /*...*/
//     });
//
function rpc(name, params, options) {
  // Fill in defaults
  options = _.defaults({}, options, {
    _retryOnCsrfError: true,
    persistent: false
  });

  // Start progress notice timer.
  return N.wire.emit('io.request').then(() => {
    let xhr = $.post('/io/rpc', JSON.stringify({
      version_hash: N.version_hash,
      method: name,
      csrf: N.runtime.token_csrf,
      params
    }));

    let p = new Promise((resolve, reject) => {
      if (!options.persistent) {
        requests.push(xhr);
      }

      // Listen for a response.
      xhr.success(data => {
        requests = _.without(requests, xhr);

        data = data || {};

        if (data.version_hash !== N.version_hash) {
          data.error = {
            code:    codes.EWRONGVER,
            message: 'Server software was updated. Please reload your page to continue.'
          };
          delete data.res;
        }

        // If invalid CSRF token error and retry is allowed.
        if (data.error && codes.INVALID_CSRF_TOKEN === data.error.code && options._retryOnCsrfError) {
          // Renew CSRF token.
          N.runtime.token_csrf = data.error.data.token;

          // Only one attempt to retry is allowed.
          options._retryOnCsrfError = false;

          // Try again.
          resolve(rpc(name, params, options));
          return;
        }

        if (data.error) {
          let error = new RPCError();

          _.assign(error, data.error);

          // TODO: log errors in 'io.complete'?
          N.wire.emit('io.complete', { error, res: null });
          reject(error);
          return;
        }

        // TODO: log errors in 'io.complete'?
        N.wire.emit('io.complete', { error: null, res: data.res });
        resolve(data.res);
      });

      // Listen for an error.
      xhr.fail((jqXHR, status) => {
        let error;

        requests = _.without(requests, xhr);

        // For possible status values see: http://api.jquery.com/jQuery.ajax/
        if (status === 'abort') {
          error = new CancellationError();
        } else {
          error = new RPCError();
          error.code = codes.ECOMMUNICATION;
        }

        // TODO: log errors in 'io.complete'?
        N.wire.emit('io.complete', { error, res: null });
        reject(error);
      });
    });

    // Extend returned promise with abort handler.
    p.cancel = xhr.abort.bind(xhr);

    return p;
  });
}


module.exports = function (_N) {

  if (!N) {
    /*eslint-disable no-undef*/
    N = _N;

    // Terminate non-persistent running rpc requests on page exit
    //
    N.wire.after('navigate.exit', function terminate_rpc_requests() {
      requests.forEach(function (xhr) {
        xhr.abort();
      });
    });
  }

  return module.exports;
};


// Export IO status/error codes
_.assign(module.exports, codes);

module.exports.rpc = rpc;
module.exports.RPCError = RPCError;
module.exports.CancellationError = CancellationError;
