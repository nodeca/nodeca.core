/**
 *  ReCaptcha
 *
 *  Module verify reCAPTCHA code
 **/


'use strict';


// 3rd-party
const _           = require('lodash');
const request     = require('request');


/**
 * ReCaptcha.verify = function (private_key, user_ip, challenge, response, callback) -> Void
 * - private_key (String): reCAPTCHA prvate key
 * - user_ip (String): user IP
 * - response (String): user captcha response
 * - callback (Function): callback function with params err, verification result
 *
 **/
module.exports.verify = function (private_key, user_ip, response, callback) {
  let data = {
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
  if (_.values(data).some(el => _.isEmpty(el))) {
    callback(new Error('ReCaptcha: Bad verify params'));
    return;
  }

  let options = {
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

    let result;

    try {
      result = JSON.parse(body);
    } catch (__) {
      callback(new Error(`reCaptcha server returned bad response: ${body}`));
      return;
    }

    callback(null, result.success);
  });
};
