'use strict';


var _ = require('lodash');


// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), tabs, active;

  tabs = $('.navbar').find('[data-api-path]');
  tabs.removeClass('active');

  // Select the most specific tab - with the longest API path match.
  active = _.maxBy(tabs, function (tab) {
    var tabPath = $(tab).data('apiPath').split('.'),
        index   = -1,
        length  = Math.min(tabPath.length, targetPath.length);

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
  // $('.navbar .navbar-collapse').collapse('hide');
  $('.navbar .navbar-collapse').removeClass('in');
});


// If secondary navbar is shown, copy a header from there to the primary
// navbar. Used in topics and sections to replace brand with progress bar
// for example.
//
N.wire.after('navigate.done:*', function navbar_replace_header() {
  let alt_header = $('#navbar-progress-source');

  if (alt_header.length) {
    $('.navbar-progress')
      .empty()
      .append(alt_header.html());

    $('.navbar').addClass('navbar__m-progress');
  }
});


// Show primary navbar and primary navbar header, empty the rest
//
N.wire.after('navigate.exit', function navbar_restore_primary_navigation() {
  $('.navbar-alt').empty();
  $('.navbar-progress').empty();

  $('.navbar').removeClass('navbar__m-secondary');
  $('.navbar').removeClass('navbar__m-progress');
});
