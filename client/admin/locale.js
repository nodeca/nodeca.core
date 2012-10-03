'use strict';


/*global window, nodeca*/


module.exports = function ($el, event) {
  var locale = $el.data('locale');

  nodeca.server.common.locale({ locale: locale }, function (err) {
    if (!err) {
      nodeca.runtime.locale = locale;
      window.location.reload();
    }
  });

  return false;
};
