// Update progress bar
//

'use strict';


N.wire.on(module.apiPath + ':update', function update_progress(data) {
  var current     = data.current,
      total       = data.max;

  if (typeof current === 'undefined' || current === null) {
    current = $('.page-progress').data('current');
  }

  if (typeof total === 'undefined' || total === null) {
    total = $('.page-progress').data('total');
  }

  $('.page-progress').data('current', current).data('total', total);

  // ensure that current is in [1..total] range, except for 0/0
  current = total > 0 ? Math.max(1, Math.min(current, total)) : 0;

  $('.page-progress__label-current').text(current);
  $('.page-progress__label-total').text(total);

  $('.page-progress__bar-fill').css({
    width: (current / total * 100).toFixed(2) + '%'
  });

  $('.page-progress__jump-input').attr('max', total);

  if (!$('.page-progress .dropdown').hasClass('open')) {
    $('.page-progress__jump-input').attr('value', current);
  }

  if (data.link_top) {
    $('.page-progress__button-first').attr('href', data.link_top);
  }

  if (data.link_bottom) {
    $('.page-progress__button-last').attr('href', data.link_bottom);
  }

  // Hide upward arrow if:
  //  - user sees the top of the page
  //  - AND current position is at the top (e.g. 1/42)
  //
  // Hide downward arrow if:
  //  - user is positioned at the last post (e.g. 42/42)
  //
  // OR:
  //  - user is positioned within 10 posts at the bottom (e.g.392/42)
  //  - AND user sees the bottom of the page (e.g. 39/42 and 3 last posts are all visible)
  //
  if (current <= 1) {
    $('.page-progress').addClass('page-progress__m-position-start');
  } else {
    $('.page-progress').removeClass('page-progress__m-position-start');
  }

  if (current >= total) {
    $('.page-progress').addClass('page-progress__m-position-end');
  } else {
    $('.page-progress').removeClass('page-progress__m-position-end');
  }

  if (current >= total - 10) {
    $('.page-progress').addClass('page-progress__m-position-near-end');
  } else {
    $('.page-progress').removeClass('page-progress__m-position-near-end');
  }
});


// Whenever user clicks on the upward arrow:
//  - if url is different, navigate to it
//  - if url is the same, scroll to the top
//
N.wire.on(module.apiPath + ':nav_to_top', function navigate_to_top(data) {
  let href = data.$this.prop('href');

  if (href === window.location.href) {
    $(window).scrollTop(0);
    return;
  }

  return N.wire.emit('navigate.to', href);
});


// Add a handler on downward arrow to assure we have similar behavior of those
// two buttons (e.g. ctrl+click is treated the same as click on both)
//
N.wire.on(module.apiPath + ':nav_to_bottom', function navigate_to_bottom(data) {
  let href = data.$this.prop('href');

  return N.wire.emit('navigate.to', href);
});


// Inject affix plugin config to track when user scrolls page to the
// top. Toggle content-top class if that happens.
//
N.wire.before('navigate.done', function add_content_affix() {
  $('#content')
    .addClass('_affix')
    .data('affix-top',    { class_above: 'content-top' })
    .data('affix-bottom', { class_below: 'content-bottom' });
});
