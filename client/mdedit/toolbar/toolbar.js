'use strict';


N.wire.once('init:mdedit', function () {

  // Set initial value
  N.MDEdit.__toolbarHotkeys__ = null;


  // Update toolbar button list
  //
  N.wire.on([ 'mdedit:init', 'mdedit:update.options' ], function updateToolbar() {
    var $toolbar = N.MDEdit.__layout__.find('.mdedit__toolbar');

    if (N.MDEdit.__toolbarHotkeys__) {
      N.MDEdit.__cm__.removeKeyMap(N.MDEdit.__toolbarHotkeys__);
    }

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

    for (let button of buttons) {
      if (!button.command || !button.bind_key || !N.MDEdit.commands[button.command]) continue;

      for (let bindKey of Object.values(button.bind_key)) {
        N.MDEdit.__toolbarHotkeys__[bindKey] = () => { N.MDEdit.commands[button.command](N.MDEdit.__cm__); };
      }
    }

    // Enable active button's hotkeys
    N.MDEdit.__cm__.addKeyMap(N.MDEdit.__toolbarHotkeys__);
  });


  // Toolbar button click
  //
  N.wire.on('mdedit.toolbar:click', function toolbar_click(data) {
    let command = N.MDEdit.commands[data.$this.data('command')].bind(N.MDEdit);

    if (command) {
      command(N.MDEdit.__cm__);

      // Restore focus on editor after command execution
      N.MDEdit.__cm__.focus();
    }
  });
});
