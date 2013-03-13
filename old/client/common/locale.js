'use strict';


/*global window, N*/


module.exports = function ($el) {
  var locale = $el.data('locale');

  N.io.rpc('common.locale', { locale: locale }, function (err) {
    if (!err) {
      N.runtime.locale = locale;
      window.location.reload();
    }
  });

  return false;
};
