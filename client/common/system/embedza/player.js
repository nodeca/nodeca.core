'use strict';

$('body').on('click', '.ez-player-preview', function () {
  var $el = $(this);

  $el.replaceWith($el.closest('.ez-player-container').data('placeholder'));
});
