/**
 *  ReCaptcha
 *
 *  Module verify reCAPTCHA code
 **/


'use strict';


// 3rd-party
const _        = require('lodash');
const got      = require('got');


/**
 * ReCaptcha.verify = function (private_key, user_ip, challenge, response, callback) -> Void
 * - private_key (String): reCAPTCHA prvate key
 * - user_ip (String): user IP
 * - response (String): user captcha response
 * - callback (Function): callback function with params err, verification result
 *
 **/
module.exports.verify = async function (private_key, user_ip, response) {
  let data = {
    secret:   private_key,
    remoteip: user_ip,
    response
  };

  // Immediately reply 'wrong captcha'
  // - if user not filled captcha field
  if (_.isEmpty(response)) {
    return false;
  }

  // If any param is empty - fail immediately, don't make request to server
  if (_.values(data).some(el => _.isEmpty(el))) {
    throw new Error('ReCaptcha: Bad verify params');
  }

  let res;

  try {
    res = await got.post(
      'https://www.google.com/recaptcha/api/siteverify',
      { form: data, retry: 1 }
    );
  } catch (err) {
    throw new Error(`reCaptcha server request failed, error: ${err.message}`);
  }

  if (res.statusCode !== 200) {
    throw new Error(`reCaptcha server request failed, status: ${res.statusCode}`);
  }

  let result;

  try {
    result = JSON.parse(res.body);
  } catch (__) {
    throw new Error(`reCaptcha server returned bad response: ${res.body}`);
  }

  return result.success;
};
