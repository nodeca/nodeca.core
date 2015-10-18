'use strict';


function loadRecaptchaScript(callback) {
  if (window.grecaptcha) {
    callback();
    return;
  }

  var cb_name = 'rc_cb' + Math.floor(Math.random() * 1000000000000);

  // handler to init captcha on script load
  window[cb_name] = function onLoad() {
    delete window[cb_name];
    callback();
  };

  var rc_url = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=' + cb_name;

  $.getScript(rc_url)
    .fail(function () {
      delete window[cb_name];
      callback(new Error('Cannot load ReCaptcha script.'));
    });
}


N.wire.on(module.apiPath + '.create', function recaptcha_create(__, callback) {

  var rc_id  = 'recaptcha_div';
  var rc_options = {
    sitekey: N.runtime.recaptcha.public_key,
    theme: 'light'
  };

  loadRecaptchaScript(function (err) {
    if (err) {
      callback(err);
      return;
    }

    window.grecaptcha.render(rc_id, rc_options);
    callback();
  });
});


N.wire.on(module.apiPath + '.update', function recaptcha_update() {
  if (!window.grecaptcha) {
    return new Error('Cannot update ReCaptcha since it is not loaded.');
  }

  window.grecaptcha.reset();
});
