'use strict';

///////////////////////////////////////////////////////////////////////////////
// Show debug timeline by `alt+ctrl+d` hotkey:
//
// - add hotkey handler on every page
// - toggle class `debug-on` on body by hotkey
//

N.wire.on('navigate.done', function debug_timeline_init_hotkey() {
  let $content = $('#content');
  let keymap = $content.data('keymap') || {};

  keymap['alt+ctrl+d'] = '@debug:toggle';
  $content.data('keymap', keymap);
});


N.wire.on('@debug:toggle', function debug_timeline_hotkey_toggle() {
  $('body').toggleClass('debug-on');
});
