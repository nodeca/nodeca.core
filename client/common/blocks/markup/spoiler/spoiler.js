// Expand/collapse a spoiler when user click on it
//

'use strict';


N.wire.once('navigate.done', function () {

  $(document).on('click', '.spoiler__title', function () {
    $(this).parent('.spoiler').toggleClass('spoiler__m-open');
  });
});
