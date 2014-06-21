/**
 *  Assigns affix tracker on every page load.
 *  Required for dynamically updated content.
 *
 *  Tracked elements should have `_affix` class
 **/


'use strict';


N.wire.on('navigate.done', function () {
  $('._affix').each(function (idx, el) {
    var $el = $(el);
    $el.affix({
      offset : {
        top: function () { return $el.offset().top; }
      }
    });
  });
});

N.wire.on('navigate.exit', function () {
  $(document).off('.affix');
});
