/**
 *  Assigns affix tracker on every page load.
 *  Required for dynamically updated content.
 *
 *  Tracked elements should have `_affix` class
 **/


'use strict';


N.wire.on('navigate.done', function affix_init() {
  $('._affix').each(function (idx, el) {
    var $el = $(el);
    var affix_top = $el.data('affix-top') || 0;
    $el.affix({
      offset : {
        top: function () { return $el.offset().top + affix_top; }
      }
    });
  });
});

N.wire.on('navigate.exit', function affix_free() {
  $(document).off('.affix');
});
