// Show current sidebar + update active item

'use strict';


const bkv = require('bkv').shared();


N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), items, active;

  var menus = $('.sidebar-menu');
  menus.addClass('d-none');

  items = menus.find('[data-api-path]');
  items.removeClass('_active');

  if (!items.length) return;

  function tab_score(tab) {
    var tabPath = $(tab).data('apiPath').split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  }

  // Select the most specific tab - with the longest API path match.
  active = Array.from(items).reduce((a, b) => (tab_score(a) >= tab_score(b) ? a : b));

  $(active).closest('.sidebar-menu').removeClass('d-none');

  // if autoselection not disabled - add highlighting class
  if ($(active).data('autoselect') !== 0) {
    $(active).addClass('_active');
  }
});


// Restore hidden sidebar state
//
N.wire.once('navigate.done', async function toggle_sidebar_on_load() {
  const hidden = await bkv.get('acp_hide_sidebar');
  $('body').toggleClass('show-sidebar', !hidden);
});


// Toggle sidebar visibility
//
N.wire.on(module.apiPath + ':toggle_sidebar', function toggle_sidebar() {
  $('body').toggleClass('show-sidebar');
  bkv.set('acp_hide_sidebar', !$('body').hasClass('show-sidebar'));
});
