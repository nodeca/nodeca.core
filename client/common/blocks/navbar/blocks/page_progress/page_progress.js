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
    $('.page-progress__button-top').attr('href', data.link_top);
  }

  if (data.link_bottom) {
    $('.page-progress__button-bottom').attr('href', data.link_bottom);
  }
});
