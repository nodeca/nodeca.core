// Extention for Twitter Bootstrap collepcer
//
// Toggles "collepsed" class on element, refered by [data-notify]
// of collapced area
//

/*eslint-disable strict*/
$(function () {
  'use strict';

  $('body').on('shown.bs.collapse.data-api hidden.bs.collapse.data-api', '[data-notify]', function (event) {
    $($(this).data('notify')).toggleClass('collapsed', event.type === 'hidden');
  });

  // Bootstrap.Collapse calls e.preventDefault() only when there's no
  // data-target attribute. We don't want URL to be changed, so we are
  // forcing prevention of default behavior.
  $('body').on('click.bs.collapse.data-api', '[data-toggle=collapse]', function (e) {
    e.preventDefault();
  });
});
