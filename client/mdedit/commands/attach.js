'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdAttach = function () {
    // TODO: move this method to nodeca.users

    var self = this;

    var data = {
      types: [ 'binary', 'image' ],
      selected: this.attachments.slice()
    };

    N.wire.emit('users.blocks.media_select_dlg', data, function () {

      self.attachments = data.selected;

      self._updateAttachments();
    });
  };
});
