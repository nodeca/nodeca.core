'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdAttach = function () {
    // TODO: move this method to nodeca.users

    let data = {
      selected: this.attachments().slice()
    };

    N.wire.emit('users.blocks.media_select_dlg', data, () => {
      this.attachments(data.selected);
    });
  };
});
