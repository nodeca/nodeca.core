/**
 *  ReCaptcha
 *
 *  Module verify reCAPTCHA code
 **/


'use strict';


// 3rd-party
var _           = require('lodash');
var request     = require('request');


/**
 * ReCaptcha.verify = function (private_key, user_ip, challenge, response, callback) -> Void
 * - private_key (String): reCAPTCHA prvate key
 * - user_ip (String): user IP
 * - response (String): user captcha response
 * - callback (Function): callback function with params err, verification result
 *
 **/
module.exports.verify = function (private_key, user_ip, response, callback) {
  var options;

  var data = {
    secret: private_key,
    remoteip:   user_ip,
    response:   response
  };

  // Immediately reply 'wrong captcha'
  // - if user not filled captcha field
  if (_.isEmpty(response)) {
    callback(null, false);
    return;
  }

  // If any param is empty - fail immediately, don't make request to server
  var all_valid = _.every(_.values(data), function (el) {
    return !_.isEmpty(el);
  });
  if (!all_valid) {
    callback(new Error('ReCaptcha: Bad verify params'));
    return;
  }

  options = {
    url: 'https://www.google.com/recaptcha/api/siteverify',
    form: data
  };

  request.post(options, function (err, res, body) {
    if (err) {
      callback(new Error('reCaptcha server request failed.'));
      return;
    }

    if (res.statusCode !== 200) {
      callback(new Error('reCaptcha server request failed.'));
      return;
    }

    var result;

    try {
      result = JSON.parse(body);
    } catch (__) {
      callback(new Error('reCaptcha server request failed.'));
      return;
    }

    callback(null, result.success);
  });
};
