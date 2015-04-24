/**
 *  io
 *
 *  This module provides realtime communication methods for Nodeca.
 **/


'use strict';


var _ = require('lodash');


// local alias to N
var N;


var requests = [];


// IO status/error codes used by RPC and HTTP servers.
var codes = require('../../io');


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
function isErrorCode(code) {
  return !isNormalCode(code);
}


/**
 *  rpc can be called in node style (with last callback), or via chained handlers.
 *
 *  ---
 *
 *  With last callback parameter you should handle all non-system errors in your callback.
 *
 *  rpc(name, [params], [options], callback) -> Void
 *
 *  Example:
 *
 *    rpc('core.test', function (error, response) {});
 *
 *  ---
 *
 *  With chained handlers - in 'fail' you can handle only client errors
 *
 *  rpc(name, [params], [options]) -> Object { done(res): Function, fail(err): Function }
 *
 *  Example:
 *
 *    // .fail   - called on N.io.CLIENT_ERROR (you can listen on specific error using `code` argument)
 *    // .done   - called if no errors
 *    // .finish - called when request is done regardless of its result
 *    rpc('core.test')
 *      .done(function (response) { ... })
 *      .fail([code, ]function (clientError) { ... });
 *      .finish(function () { ... });
 *
 **/
function rpc(name, params, options, callback) {
  var xhr;
  var done = [];
  var fail = [];
  var finish = [];

  // Scenario: rpc(name, callback);
  if (_.isFunction(params)) {
    callback = params;
    params = options = {};
  }

  // Scenario: rpc(name, params[, callback]);
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // Fill in defaults
  options = _.defaults({}, options, {
    _retryOnCsrfError: true,
    handleAllErrors: false
  });

  // Send request
  N.wire.emit('io.request');

  xhr = /*__lastRPCRequest__ =*/ $.post('/io/rpc', JSON.stringify({
    version: N.version,
    method:  name,
    csrf:    N.runtime.csrf,
    params:  params
  }));

  requests.push(xhr);

  // Listen for a response.
  xhr.success(function (data) {
    requests = _.without(requests, xhr);

    data = data || {};

    if (data.version !== N.version) {
      data.error = {
        code:    codes.EWRONGVER,
        message: 'Client version does not match server.'
      };
      delete data.res;
    }

    // If invalid CSRF token error and retry is allowed.
    if (data.error && codes.INVALID_CSRF_TOKEN === data.error.code && options._retryOnCsrfError) {
      // Renew CSRF token.
      N.runtime.csrf = data.error.data.token;

      // Only one attempt to retry is allowed.
      options._retryOnCsrfError = false;

      // Try again.
      rpc(name, params, options, callback)
        .done(function (res) {
          done.forEach(function (fn) { fn(res); });
        })
        .fail(function (res) {
          fail.forEach(function (obj) {
            if (!obj || !obj.code || obj.code === res.code) {
              obj.fn(res);
            }
          });
        })
        .finish(function (res) {
          finish.forEach(function (fn) { fn(res); });
        });

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

    // If called with callback - don't emit notification. User should care about non-system errors
    if (callback) {
      callback(data.error, data.res);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    if (data.error) {
      // this variable will be true iff at least one fail handler is called
      var error_handled = fail.reduce(function (acc, obj) {
        // call fail(code, fn) if code matches
        //
        if (obj && obj.code === data.error.code) {
          obj.fn.call(null, data.error);
          return true;
        }

        // call fail(fn) if client error or handleAllErrors is set
        //
        if (options.handleAllErrors || data.error.code === codes.CLIENT_ERROR) {
          obj.fn.call(null, data.error);
          return true;
        }

        return acc;
      }, false);

      // If client error or `handleAllErrors` flag and have listeners - don't show default notification
      if (error_handled) {
        finish.forEach(function (fn) {
          fn(data.error);
        });
        N.wire.emit('io.complete', { error: data.error, res: data.res });
        return;
      }

      // Show notification without any callback
      N.wire.emit('io.error', data.error);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    // Finish on success
    done.forEach(function (fn) {
      fn(data.res);
    });
    finish.forEach(function (fn) {
      fn();
    });
    N.wire.emit('io.complete', { error: data.error, res: data.res });

    return;
  });

  // Listen for an error.
  xhr.fail(function (jqXHR, status) {
    requests = _.without(requests, xhr);

    var err;

    // For possible status values see: http://api.jquery.com/jQuery.ajax/
    if (status === 'abort') {
      N.wire.emit('io.complete', { error: err, response: null });
      return;
    }

    N.logger.error('Failed RPC call: %s', status, jqXHR);

    // Any non-abort error - is a communication problem.
    err = { code: codes.ECOMMUNICATION };

    finish.forEach(function (fn) {
      fn();
    });
    N.wire.emit('io.error', err);
    N.wire.emit('io.complete', { error: err, response: null });
  });

  // Can't use callback and chaining at the same time
  if (callback) {
    return null;
  }

  var curry = {
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
    }
  };
  return curry;
}


module.exports = function (_N) {

  if (!N) {
    /*eslint-disable no-undef*/
    N = _N;

    // Terminate all running rpc requests on page exit
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
