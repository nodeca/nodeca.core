'use strict';


/*global $, nodeca, noty*/


module.exports = function (options) {
  if ('string' === typeof options) {
    options = { text: options };
  }

  return noty({
    theme:    'nodecaTheme',
    layout:   options.type || 'notification',
    text:     options.text,
    template:
      '<div class="noty_message alert">' +
      '<button class="noty_close close>×</button>' +
      '<span class="noty_text message"></span>' +
      '</div>'
  });
};
