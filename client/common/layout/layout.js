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
N.wire.on('navigate.exit', function navbar_menu_change_active(target) {
  var apiPath = target.apiPath, tabs, active;

  function matchLengthOf(subject) {
    var index  = 0
      , length = Math.min(apiPath.length, subject.length);

    while (index < length &&
           subject.charCodeAt(index) === apiPath.charCodeAt(index)) {
      index += 1;
    }

    return index;
  }

  tabs = $('#navbar_menu').find('[data-api-path]').removeClass('active');

  // Select the most specific tab - with the longest API path match.
  active = _.max(tabs, function (tab) {
    return matchLengthOf($(tab).attr('data-api-path'));
  });

  $(active).addClass('active');
});
