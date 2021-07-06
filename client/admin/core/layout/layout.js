'use strict';


//
// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), tabs, active;

  tabs = $('.layout__navbar').find('[data-api-path]');
  tabs.removeClass('show');

  if (!tabs.length) return;

  function tab_score(tab) {
    var tabPath = $(tab).data('apiPath').split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  }

  // Select the most specific tab - with the longest API path match.
  active = Array.from(tabs).reduce((a, b) => (tab_score(a) >= tab_score(b) ? a : b));

  // need to use either .nav-item.show or .nav-item>.nav-link.active
  $(active).addClass('show');
});
