/**
 *  io
 *
 *  This module provides realtime communication methods for Nodeca.
 **/
'use strict';


// IO status/error codes used by RPC and HTTP servers.
const codes = require('../../io');
const bkv   = require('bkv').shared();


module.exports = function (N) {
  let abortable_requests = [];


  // Define custom error classes
  //
  function RPCError() {
  }

  RPCError.prototype = Object.create(Error.prototype);

  let token;
  const STORAGE_KEY = 'csrf_token';

  // rpc(name, [params], [options]) -> Promise
  //
  // Params: an arbitrary JSON object, File or Blob entries are allowed on top
  // level of said object (serialized into json without files or multipart form
  // with files).
  //
  // Options:
  //
  // - persistent - optional, do not terminate request by `navigate.exit`, default `false`
  // - cancel     - optional (Array) to memoise abort functions
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
  async function rpc(name, params, options = {}) {
    // Fill in defaults
    options._retryOnCsrfError = options._retryOnCsrfError ?? true;
    options.persistent = options.persistent ?? false;

    if (!options._retryOnCsrfError) {
      // Start progress notice timer.
      N.wire.emit('io.request');
    }

    let files = [];
    let xhr;
    let contentType;
    let formData;

    if (!token) token = await bkv.get(STORAGE_KEY);

    let data = JSON.stringify({
      assets_hash: N.runtime.assets_hash,
      method: name,
      csrf: token,
      params
    }, (key, value) => {
      // Collect files separate (assume that File is inherited from Blob)
      if (value instanceof Blob) {
        files.push({ key, value });
        return;
      }
      return value;
    });

    if (files.length) {
      formData = new FormData();
      formData.append('__payload__', data);
      files.forEach(file => formData.append(file.key, file.value));
      contentType = false; // will be auto-set to "multipart/form-data; boundary=..."
    } else {
      formData = data;
      contentType = 'application/json';
    }

    xhr = $.ajax({
      url: '/io/rpc',
      type: 'POST',
      data: formData,
      dataType: 'json',
      contentType,
      // turn off replacing encoded spaces like '%20' with '+', see
      // https://github.com/jquery/jquery/issues/2658
      processData: false,
      xhr() {
        let xhr = $.ajaxSettings.xhr();

        if (options.onProgress && xhr.upload) {
          xhr.upload.addEventListener('progress', options.onProgress);
        }

        return xhr;
      }
    });

    if (!options.persistent) abortable_requests.push(xhr);

    if (options.cancel) options.cancel.push(xhr.abort.bind(xhr));

    try {
      let data = await Promise.resolve(xhr);

      abortable_requests = abortable_requests.filter(x => x !== xhr);

      data = data || {};

      if (data.assets_hash !== N.runtime.assets_hash) {
        data.error = {
          code: codes.EWRONGVER,
          hash: data.assets_hash,
          message: 'Server software was updated. Please reload your page to continue.'
        };
        delete data.res;
      }

      // If invalid CSRF token error and retry is allowed.
      if (data.error && codes.INVALID_CSRF_TOKEN === data.error.code && options._retryOnCsrfError) {
        token = data.error.csrf_token;
        // Store token to save request on page reload
        bkv.set(STORAGE_KEY, token);

        // Only one attempt to retry is allowed.
        options._retryOnCsrfError = false;

        // Try again.
        return rpc(name, params, options);
      }

      if (data.error) {
        let error = new RPCError();

        Object.assign(error, data.error);
        N.wire.emit('io.complete', { error, res: null });
        throw error;
      }

      N.wire.emit('io.complete', { error: null, res: data.res });
      return data.res;

    } catch (err) {

      if (err instanceof RPCError) throw err;

      let error;

      abortable_requests = abortable_requests.filter(x => x !== xhr);

      // For possible status values see: http://api.jquery.com/jQuery.ajax/
      if (err.statusText === 'abort') {
        error = 'CANCELED';
      } else {
        error = new RPCError();
        error.code = codes.ECOMMUNICATION;
      }

      N.wire.emit('io.complete', { error, res: null });
      throw error;
    }
  }


  // Terminate non-persistent running rpc requests on page exit
  //
  N.wire.after('navigate.exit', function terminate_rpc_requests() {
    abortable_requests.forEach(xhr => xhr.abort());
    abortable_requests = [];
  });


  return { ...codes, rpc, RPCError };
};
