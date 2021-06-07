'use strict';


const _ = require('lodash');


// Update "active" tab of the navbar_menu when moving to another page.
//
N.wire.on('navigate.done', function navbar_menu_change_active(target) {
  var targetPath = target.apiPath.split('.'), tabs, active;

  tabs = $('.navbar').find('[data-api-path]');
  tabs.removeClass('show');

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
    // need to use either .nav-item.show or .nav-item>.nav-link.active
    $(active).addClass('show');
  }
});


// Minimize navbar on navigation. Needed for mobile devices.
//
N.wire.on('navigate.to', function navbar_menu_minimize() {
  // Remove class manually:
  // - animation not needed
  // - avoid nasty effect on full menu
  // $('.navbar .navbar-collapse').collapse('hide');
  $('.navbar .navbar-collapse').removeClass('show');
});


// When user scrolls the page, show secondary navbar if user scrolls
// past page head.
//
let scroll_handler = null;
let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);


N.wire.after('navigate.done', function secondary_navbar_show() {
  if (document.getElementsByClassName('page-head').length === 0) return;
  if (document.getElementsByClassName('navbar-alt').length === 0) return;

  scroll_handler = _.debounce(function update_progress_on_scroll() {
    let head = document.getElementsByClassName('page-head');

    if (head.length && head[0].getBoundingClientRect().bottom > navbar_height) {
      $('.navbar').removeClass('navbar__m-secondary');
    } else {
      $('.navbar').addClass('navbar__m-secondary');
    }
  }, 100, { maxWait: 100 });

  // avoid executing it on first tick because of possible initial scrollTop()
  setTimeout(() => {
    $(window).on('scroll', scroll_handler);
  }, 1);

  // execute it once on page load
  scroll_handler();
});


N.wire.on('navigate.exit', function progress_updater_teardown() {
  if (!scroll_handler) return;
  scroll_handler.cancel();
  $(window).off('scroll', scroll_handler);
  scroll_handler = null;
});
