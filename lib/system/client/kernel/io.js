/**
 *  io
 *
 *  This module provides realtime communication methods for Nodeca.
 **/


'use strict';


const _ = require('lodash');
// IO status/error codes used by RPC and HTTP servers.
const codes = require('../../io');


// local alias to N
let N;
let requests = [];


// Checks for a non-system error which should be passed to the callback.
//
function isNormalCode(code) {
  return (200 <= code && code <= 299) ||
         (300 <= code && code <= 399) ||
         code === codes.FORBIDDEN     ||
         code === codes.NOT_FOUND     ||
         code === codes.CLIENT_ERROR;
}


// Checks for a system-level error which should *NOT* be passed to the callback.
// These errors are emitted to 'io.error' Wire channel.
//
function isErrorCode(code) { return !isNormalCode(code); }


// rpc(name, [params], [options]) -> Object
//
// Returned object:
//
// - done(fn) - `fn(res)`, called if no errors
// - fail([code,] fn) - `fn(err)`, called on N.io.CLIENT_ERROR (you can listen on specific error using `code` argument)
// - finish(fn) - `fn(res)`, called when request is done regardless of its result
// - cancel() - cancel request
//
// Options:
//
// - handleAllErrors - optional, if code not specified handle all errors in `fail` handler, default `false`
// - persistent - optional, do not terminate request by `navigate.exit`, default `false`
//
// Example:
//
//   rpc('core.test')
//     .done(function (response) { ... })
//     .fail([code, ]function (clientError) { ... })
//     .finish(function () { ... });
//
function rpc(name, params, options) {
  let xhr;
  let done = [], fail = [], finish = [];

  // Fill in defaults
  options = _.defaults({}, options, {
    _retryOnCsrfError: true,
    handleAllErrors: false,
    persistent: false
  });

  // Send request
  N.wire.emit('io.request');

  xhr = /*__lastRPCRequest__ =*/ $.post('/io/rpc', JSON.stringify({
    version_hash: N.version_hash,
    method: name,
    csrf: N.runtime.token_csrf,
    params: params
  }));

  if (!options.persistent) {
    requests.push(xhr);
  }

  // Listen for a response.
  xhr.success(function (data) {
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

      // Try again with curring.
      rpc(name, params, options)
        .done(res =>  done.forEach(fn => fn(res)))
        .fail(res => {
          fail.forEach(obj => {
            if (!obj || !obj.code || obj.code === res.code) {
              obj.fn(res);
            }
          });
        })
        .finish(res => finish.forEach(fn => fn(res)));

      return;
    }

    if (!options.handleAllErrors) {
      // If system error - just show notification
      if (data.error && isErrorCode(data.error.code)) {
        N.wire.emit('io.error', data.error);
        N.wire.emit('io.complete', { error: data.error, res: data.res });
        return;
      }
    }

    if (data.error) {
      // this variable will be true if at least one fail handler is called
      let error_handled = fail.reduce((acc, obj) => {

        // call fail(code, fn) if code matches
        if (obj && obj.code === data.error.code) {
          obj.fn.call(null, data.error);
          return true;
        }

        // call fail(fn) if client error or handleAllErrors is set
        if (options.handleAllErrors || data.error.code === codes.CLIENT_ERROR) {
          obj.fn.call(null, data.error);
          return true;
        }

        return acc;
      }, false);

      // If client error or `handleAllErrors` flag and have listeners - don't show default notification
      if (error_handled) {
        finish.forEach(fn => fn(data.error));
        N.wire.emit('io.complete', { error: data.error, res: data.res });
        return;
      }

      // Show notification without any callback
      N.wire.emit('io.error', data.error);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    // Finish on success
    done.forEach(fn => fn(data.res));
    finish.forEach(fn => fn());

    N.wire.emit('io.complete', { error: data.error, res: data.res });

    return;
  });

  // Listen for an error.
  xhr.fail(function (jqXHR, status) {
    requests = _.without(requests, xhr);

    let err;

    // For possible status values see: http://api.jquery.com/jQuery.ajax/
    if (status === 'abort') {
      N.wire.emit('io.complete', { error: err, response: null });
      return;
    }

    N.logger.error('Failed RPC call: %s', status, jqXHR);

    // Any non-abort error - is a communication problem.
    err = { code: codes.ECOMMUNICATION };

    finish.forEach(fn => fn());

    N.wire.emit('io.error', err);
    N.wire.emit('io.complete', { error: err, response: null });
  });

  let curry = {
    done: function (fn) {
      done.push(fn);
      return curry;
    },
    fail: function (code, fn) {
      if (typeof code === 'function') {
        // fail(fn)
        fail.push({ fn: code });
      } else {
        // fail(code, fn)
        fail.push({ code: code, fn: fn });
      }
      return curry;
    },
    finish: function (fn) {
      finish.push(fn);
      return curry;
    },
    cancel: function () {
      xhr.abort();
    }
  };
  return curry;
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
