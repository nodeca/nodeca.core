// Extention for Twitter Bootstrap collepcer
//
// Toggles "collepsed" class on element, refered by [data-notify]
// of collapced area
//

$(function () {
  'use strict';

  $('body').on('shown.collapse.data-api hidden.collapse.data-api', '[data-notify]', function (event) {
    $($(this).data('notify')).toggleClass('collapsed', 'hidden' === event.type);
  });
});
