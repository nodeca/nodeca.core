'use strict';


/*global yepnope*/


N.wire.on(module.apiPath + '.create', function recaptcha_create(__, callback) {
  yepnope({
    load: '//www.google.com/recaptcha/api/js/recaptcha_ajax.js',
    complete: function () {
      if (!window.Recaptcha) {
        callback(new Error('Cannot load ReCaptcha script.'));
        return;
      }

      window.Recaptcha.create(N.runtime.recaptcha.public_key, 'recaptcha_div', {
        theme: 'custom'
      });
      callback();
    }
  });
});


N.wire.on(module.apiPath + '.update', function recaptcha_update() {
  if (!window.Recaptcha) {
    return new Error('Cannot update ReCaptcha since it is not loaded.');
  }

  window.Recaptcha.reload();
  window.Recaptcha.focus_response_field();
});
