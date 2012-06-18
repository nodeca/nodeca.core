/*global nodeca, $*/

$(function () {
  'use strict';

  $('body').on('shown.collapse.data-api hidden.collapse.data-api', '[data-notify]', function (event) {
    $( $(this).data('notify') ).toggleClass('collapsed', 'shown' === event.type);
  });
});
