/**
 *  ReCaptch
 *
 *  Module verify reCAPTCHA code
 **/


'use strict';


/*global _*/


// 3rd-party
var http        = require('http');
var queryString = require('querystring');


/**
 * ReCaptch.verify = function (private_key, user_ip, challenge, response, callback) -> Void
 * - private_key (String): reCAPTCHA prvate key
 * - user_ip (String): user IP
 * - challenge (String): captcha id
 * - response (String): user captcha response
 * - callback (Function): callback function with params err, verification result
 *
 **/
module.exports.verify = function (private_key, user_ip, challenge, response, callback) {
  var request,
      options;

  var data = {
    'privatekey': private_key,
    'remoteip': user_ip,
    'challenge': challenge,
    'response': response
  };

  // Immideately reply empty challenge as wrong captcha
  if (_.isEmpty(challenge)) {
    callback(null, false);
    return;
  }

  // If any param is empty - fail immediately, don't make request to server
  var all_valid = _.all(_.values(data), function (el) {
    return !_.isEmpty(el);
  });
  if (!all_valid) {
    callback(new Error('ReCaptcha: Bad verify params'));
    return;
  }

  data = queryString.stringify(data);

  options = {
    host: 'www.google.com',
    path: '/recaptcha/api/verify',
    port: 80,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length
    }
  };

  request = http.request(options, function (response) {
    var body = '';

    response.on('error', function () {
      callback(new Error('reCaptcha server request filed.'));
    });

    response.on('data', function (chunk) {
      body += chunk;
    });

    response.on('end', function () {
      var success, error_code, parts;

      parts = body.split('\n');
      success = parts[0];
      error_code = parts[1];

      // Wrong captcha code
      if (error_code === 'incorrect-captcha-sol') {
        callback(null, false);
        return;
      }

      // Other errors (should not happen)
      // Errors list: https://developers.google.com/recaptcha/docs/verify
      if (success !== 'true') {
        callback(new Error(error_code));
        return;
      }

      // Success
      callback(null, true);
    });

  });

  request.write(data, 'utf8');
  request.end();
};
