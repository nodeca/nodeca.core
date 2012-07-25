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
  $notice   = $('#io-notice');
  $message  = $notice.find('.message');

  $notice.find('.close').click(module.exports.hide);

  module.exports.hide();
});
