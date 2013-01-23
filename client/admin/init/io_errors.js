'use strict';


/*global N*/


////////////////////////////////////////////////////////////////////////////////


// automate serious errors notificating
//
module.exports = function () {
  N.on('rpc.error', function (err) {
    if (N.io.INVALID_CSRF_TOKEN === err.code) {
      N.runtime.csrf = err.data.token;
      N.client.admin.notify(N.runtime.t('admin.io.error.invalid_csrf_token'));
      return;
    }

    if (N.io.APP_ERROR === err.code) {
      N.client.admin.notify(N.runtime.t('admin.io.error.application_fuckup'));
      return;
    }

    if (N.io.ECOMMUNICATION === err.code) {
      N.client.admin.notify(N.runtime.t('admin.io.error.communication_timeout'));
      return;
    }
  });
};
