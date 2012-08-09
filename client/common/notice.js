'use strict';


/*global $, nodeca*/


var $notice = $([]), $message = $([]);


function init() {
  if (!$notice.length) {
    $notice   = $(nodeca.views.widgets.notice());
    $message  = $notice.find('.message');

    $notice.appendTo($('body'));
    $notice.find('.close').click(module.exports.hide);

    module.exports.hide();
  }
}


module.exports.show = function (message) {
  init();
  $message.html(message);
  $notice.show();
};


module.exports.hide = function () {
  $notice.hide();
  $message.html('');
};
