// When page loads, scroll to an anchor offset by the navbar height
//

'use strict';

const navbarHeight = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);


N.wire.on('navigate.done:*', { priority: 990 }, function scroll_to_anchor(data) {
  if (data.no_scroll || !data.anchor) return;

  var el = $(data.anchor);

  if (!el.length) return;

  data.no_scroll = true;
  $(window).scrollTop(el.offset().top - navbarHeight);
});
