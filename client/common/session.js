'use strict';

module.exports.setLocale = function (locale) {
  nodeca.io.apiTree('common.session.setLocale', { locale: locale }, function (err) {
    if (!err) {
      nodeca.runtime.locale = locale;
      window.location.reload();
    }
  });
};
