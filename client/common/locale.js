'use strict';

module.exports = function (locale) {
  nodeca.server.common.locale({ locale: locale }, function (err) {
    if (!err) {
      nodeca.runtime.locale = locale;
      window.location.reload();
    }
  });
};
