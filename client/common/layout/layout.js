'use strict';


var _ = require('lodash');


//
// Observe quicksearch focus to tweak icon style
//
N.wire.once('navigate.done', function () {
  $('.navbar-search .search-query')
    .focus(function () { $(this).next('div').addClass('focused'); })
    .blur(function () { $(this).next('div').removeClass('focused'); });
});


//
// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), tabs, active;

  tabs = $('.layout__navbar').find('[data-api-path]');
  tabs.removeClass('active');

  // Select the most specific tab - with the longest API path match.
  active = _.max(tabs, function (tab) {
    var tabPath = $(tab).data('apiPath').split('.')
      , index   = -1
      , length  = Math.min(tabPath.length, targetPath.length);

    do { index += 1; }
    while (index < length && tabPath[index] === targetPath[index]);

    return index;
  });

  $(active).addClass('active');
});


//
// Minimize navbar on navigation. Needed for mobile devices.
//
N.wire.on('navigate.exit', function navbar_menu_minimize() {
  $('.nav-collapse').collapse('hide');
});
