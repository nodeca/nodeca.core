// Extention for Twitter Bootstrap collepcer
//
// Toggles "collepsed" class on element, refered by [data-notify]
// of collapced area
//


'use strict';


$(function () {
  $('body').on('shown.bs.collapse.data-api hidden.bs.collapse.data-api', '[data-notify]', function (event) {
    $($(this).data('notify')).toggleClass('collapsed', 'hidden' === event.type);
  });

  // Bootstrap.Collapse calls e.preventDefault() only when there's no
  // data-target attribute. We don't want URL to be changed, so we are
  // forcing prevention of default behavior.
  $('body').on('click.bs.collapse.data-api', '[data-toggle=collapse]', function (e) {
    e.preventDefault();
  });
});
