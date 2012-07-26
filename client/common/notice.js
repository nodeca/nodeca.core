'use strict';


/*global $*/


var $notice = $([]), $message = $([]);


module.exports.show = function (message) {
  $message.html(message);
  $notice.show();
};


module.exports.hide = function () {
  $notice.hide();
  $message.html('');
};


$(function () {
  $notice   = $(nodeca.views.widgets.notice());
  $message  = $notice.find('.message');

  $notice.appendTo(document.body);
  $notice.find('.close').click(module.exports.hide);

  module.exports.hide();
});
