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

  tabs = $('.nav-horiz').find('[data-api-path]');
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

  // if autoselection not disabled - add highlighting class
  if ($(active).data('autoselect') !== 0) {
    $(active).addClass('active');
  }
});


// Minimize navbar on navigation. Needed for mobile devices.
//
N.wire.on('navigate.to', function navbar_menu_minimize() {
  // Remove class manually:
  // - animation not needed
  // - avoid nasty effect on full menu
  //$('.nav-horiz .navbar-collapse').collapse('hide');
  $('.nav-horiz .navbar-collapse').removeClass('in');
});
