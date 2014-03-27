'use strict';


N.wire.on(module.apiPath + '.create', function recaptcha_create(__, callback) {

  var rc_url = '//www.google.com/recaptcha/api/js/recaptcha_ajax.js';
  var rc_key = N.runtime.recaptcha.public_key;
  var rc_id  = 'recaptcha_div';
  var rc_options = { theme: 'custom' };

  if (window.ReCaptcha) {
    window.Recaptcha.create(rc_key, rc_id, rc_options);
    callback();
    return;
  }

  $.getScript(rc_url)
    .done(function () {
      window.Recaptcha.create(rc_key, rc_id, rc_options);
      callback();
    })
    .fail(function () {
      callback(new Error('Cannot load ReCaptcha script.'));
    });
});


N.wire.on(module.apiPath + '.update', function recaptcha_update() {
  if (!window.Recaptcha) {
    return new Error('Cannot update ReCaptcha since it is not loaded.');
  }

  window.Recaptcha.reload();
  window.Recaptcha.focus_response_field();
});
