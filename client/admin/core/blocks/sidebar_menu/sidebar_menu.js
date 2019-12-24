// Show current sidebar + update active item

'use strict';


const _   = require('lodash');
const bag = require('bagjs')({ prefix: 'nodeca' });


N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), items, active;

  var menus = $('.sidebar-menu');
  menus.addClass('d-none');

  items = menus.find('[data-api-path]');
  items.removeClass('_active');

  // Select the most specific tab - with the longest API path match.
  active = _.maxBy(items, function (tab) {
    var tabPath = $(tab).data('apiPath').split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  });

  $(active).closest('.sidebar-menu').removeClass('d-none');

  // if autoselection not disabled - add highlighting class
  if ($(active).data('autoselect') !== 0) {
    $(active).addClass('_active');
  }
});


// Restore hidden sidebar state
//
N.wire.once('navigate.done', function toggle_sidebar_on_load() {
  return bag.get('acp_hide_sidebar').then(hidden => {
    $('body').toggleClass('show-sidebar', !hidden);
  })
  .catch(() => {}); // Suppress storage errors
});


// Toggle sidebar visibility
//
N.wire.on(module.apiPath + ':toggle_sidebar', function toggle_sidebar() {
  $('body').toggleClass('show-sidebar');
  bag.set('acp_hide_sidebar', !$('body').hasClass('show-sidebar'));
});
