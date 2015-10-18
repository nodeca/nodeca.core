'use strict';


N.wire.on(module.apiPath + '.create', function recaptcha_create(__, callback) {

  var rc_url = 'https://www.google.com/recaptcha/api.js?render=explicit';
  var rc_id  = 'recaptcha_div';
  var rc_options = {
    sitekey: N.runtime.recaptcha.public_key,
    theme: 'light'
  };

  if (window.grecaptcha) {
    window.grecaptcha.render(rc_id, rc_options);
    callback();
    return;
  }

  $.getScript(rc_url)
    .done(function () {
      setTimeout(function () {
        window.grecaptcha.render(rc_id, rc_options);
        callback();
      }, 1000);
    })
    .fail(function () {
      callback(new Error('Cannot load ReCaptcha script.'));
    });
});


N.wire.on(module.apiPath + '.update', function recaptcha_update() {
  if (!window.grecaptcha) {
    return new Error('Cannot update ReCaptcha since it is not loaded.');
  }

  window.grecaptcha.reset();
});
