'use strict';


N.wire.once('init:mdedit', function () {

  // Set initial value
  N.MDEdit.__toolbarHotkeys__ = null;


  // Update toolbar button list
  //
  N.wire.on([ 'mdedit:init', 'mdedit:update.options' ], function updateToolbar() {
    let $toolbar = N.MDEdit.__layout__.find('.mdedit__toolbar');

    // Get actual buttons
    let buttons = [];

    for (let btn of N.MDEdit.__options__.toolbar) {
      // If parser plugin inactive - remove button
      if (btn.depend && !N.MDEdit.__options__.parseOptions[btn.depend]) continue;

      // If duplicate separator - remove it
      if (btn.separator && buttons.length > 0 && buttons[buttons.length - 1].separator) continue;

      buttons.push(btn);
    }

    // If first item is separator - remove
    if (buttons.length > 0 && buttons[0].separator) {
      buttons.shift();
    }

    // If last item is separator - remove
    if (buttons.length > 0 && buttons[buttons.length - 1].separator) {
      buttons.pop();
    }

    // Render toolbar
    $toolbar.html(N.runtime.render('mdedit.toolbar', { buttons }));

    // Process hotkeys for editor
    N.MDEdit.__toolbarHotkeys__ = {};
    let keymap = {};

    for (let button of buttons) {
      if (!button.command || !button.bind_key || !N.MDEdit.commands[button.command]) continue;

      for (let bindKey of Object.values(button.bind_key)) {
        N.MDEdit.__toolbarHotkeys__[bindKey] = button.command;
        keymap[bindKey] = 'mdedit.toolbar:keydown';
      }
    }

    N.MDEdit.__layout__.data('keymap', {
      ...N.MDEdit.__layout__.data('keymap'),
      ...keymap
    });
  });


  // Toolbar button click
  //
  N.wire.on('mdedit.toolbar:click', function toolbar_click(data) {
    N.MDEdit.commands[data.$this.data('command')].call(N.MDEdit, N.MDEdit.__textarea__);

    // Restore focus on editor after command execution
    N.MDEdit.__textarea__.focus();
  });


  // Hotkey press
  //
  N.wire.on('mdedit.toolbar:keydown', function toolbar_keydown(data) {
    let command = N.MDEdit.__toolbarHotkeys__[data.key];

    N.MDEdit.commands[command].call(N.MDEdit, N.MDEdit.__textarea__);
  });
});
