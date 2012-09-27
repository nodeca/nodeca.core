'use strict';


/*global $, nodeca, noty*/


module.exports.show = function show(options) {
  if ('string' === typeof options) {
    options = { text: options };
  }

  return noty({
    theme:    'nodecaTheme',
    layout:   options.type || 'notification',
    text:     options.text
  });
};


module.exports.hide = function hide(noty) {
  if ('string' === typeof noty) {
    $.each($.noty.store, function () {
      if (!this.closed && this.options.layout.name === noty) {
        module.exports.hide(this);
      }
    });

    return;
  }

  $.noty.close(noty);
  return;
};
