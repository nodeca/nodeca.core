// automate serious errors notificating
//


'use strict';


var notify = require('./_notify');


N.wire.on('io.error', function (err) {
  if (N.io.INVALID_CSRF_TOKEN === err.code) {
    N.runtime.csrf = err.data.token;
    notify(t('invalid_csrf_token'));

  } else if (N.io.APP_ERROR === err.code) {
    notify(t('application_fuckup'));

  } else if (N.io.ECOMMUNICATION === err.code) {
    notify(t('communication_timeout'));
  }
});
