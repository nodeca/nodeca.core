'use strict';


// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  let targetPath = target.apiPath.split('.'), tabs;

  tabs = $('.navbar__hovered').find('[data-api-path]');
  tabs.removeClass('show');

  if (!tabs.length) return;

  function tab_score(apiPath) {
    let tabPath = apiPath.split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  }

  // Select the most specific tab - with the longest API path match.
  let bestPath = Array.from(tabs).map(t => $(t).data('apiPath'))
                   .reduce((a, b) => (tab_score(a) >= tab_score(b) ? a : b));

  for (let tab of Array.from(tabs)) {
    let $tab = $(tab);
    if ($tab.data('apiPath') !== bestPath) continue;

    // if autoselection not disabled - add highlighting class
    if ($tab.data('autoselect') !== 0) {
      // need to use either .nav-item.show or .nav-item>.nav-link.active
      $tab.addClass('show');
    }
  }
});
