'use strict';


/*global $, nodeca*/


////////////////////////////////////////////////////////////////////////////////


// automate serious errors notificating
//
module.exports = function () {
  nodeca.io.on('rpc.error', function (err) {
    if (nodeca.io.INVALID_CSRF_TOKEN === err.code) {
      nodeca.runtime.csrf = err.data.token;
      nodeca.client.admin.notify(nodeca.runtime.t('admin.io.error.invalid_csrf_token'));
      return;
    }

    if (nodeca.io.APP_ERROR === err.code) {
      nodeca.client.admin.notify(nodeca.runtime.t('admin.io.error.application_fuckup'));
      return;
    }

    if (nodeca.io.ECOMMUNICATION === err.code) {
      nodeca.client.admin.notify(nodeca.runtime.t('admin.io.error.communication_timeout'));
      return;
    }
  });
};
