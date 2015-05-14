// Expand/collapse a spoiler when user click on it
//

'use strict';


N.wire.once('navigate.done', function () {

  $(document).on('click', '.spoiler__title', function (event) {
    var spoiler = $(this).parent('.spoiler');

    if (spoiler.hasClass('spoiler__m-open')) {
      spoiler.removeClass('spoiler__m-open');
      spoiler.children('.spoiler__content').show().stop().hide('fast');
    } else {
      spoiler.addClass('spoiler__m-open');
      spoiler.children('.spoiler__content').hide().stop().show('fast');
    }
  });
});
