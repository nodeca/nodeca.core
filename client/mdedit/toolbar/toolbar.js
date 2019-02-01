'use strict';


var _ = require('lodash');


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
    var buttons = _.reduce(N.MDEdit.__options__.toolbar, function (result, btn) {

      // If parser plugin inactive - remove button
      if (btn.depend && !N.MDEdit.__options__.parseOptions[btn.depend]) {
        return result;
      }

      // If duplicate separator - remove it
      if (btn.separator && result.length > 0 && result[result.length - 1].separator) {
        return result;
      }

      result.push(btn);

      return result;
    }, []);

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
    N.MDEdit.__toolbarHotkeys__ = buttons.reduce(function (result, button) {
      if (!button.command || !button.bind_key || !N.MDEdit.commands[button.command]) {
        return result;
      }

      _.forEach(button.bind_key, function (bindKey) {
        result[bindKey] = function () {
          N.MDEdit.commands[button.command](N.MDEdit.__cm__);
        };
      });

      return result;
    }, {});

    // Enable active button's hotkeys
    N.MDEdit.__cm__.addKeyMap(N.MDEdit.__toolbarHotkeys__);
  });


  // Toolbar button click
  //
  N.wire.on('mdedit.toolbar:click', function toolbar_click(data) {
    var command = N.MDEdit.commands[data.$this.data('command')].bind(N.MDEdit);

    if (command) {
      command(N.MDEdit.__cm__);

      // Restore focus on editor after command execution
      N.MDEdit.__cm__.focus();
    }
  });
});
