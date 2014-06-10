// Show current sidebar + update active item

'use strict';


var _ = require('lodash');


N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), items, active;

  var menus = $('.sidebar-menu');
  menus.addClass('hidden');

  items = menus.find('[data-api-path]');
  items.removeClass('_active');

  // Select the most specific tab - with the longest API path match.
  active = _.max(items, function (tab) {
    var tabPath = $(tab).data('apiPath').split('.')
      , index   = -1
      , length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  });

  $(active).closest('.sidebar-menu').removeClass('hidden');

  // if autoselection not disabled - add highlighting class
  if ($(active).data('autoselect') !== 0) {
    $(active).addClass('_active');
  }
});
