'use strict';


$(function () {
  //
  // Observe quicksearch focus to tweak icon style
  //
  $('.navbar-search .search-query')
    .focus(function () { $(this).next('div').addClass('focused'); })
    .blur(function () { $(this).next('div').removeClass('focused'); });
});
