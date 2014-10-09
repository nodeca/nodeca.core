'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdAttach = function () {
    // TODO: show real dialog
    // TODO: move this method to nodeca.users

    var self = this;

    var data = { user_hid: 1, album_id: '53f1cbe70f78750000af85c8', cover_id: null };
    N.wire.emit('users.album.edit.select_cover', data, function () {

      if (self.attachments.indexOf(data.cover_id) !== -1) {
        // attachment already exists
        return;
      }

      self.attachments.unshift(data.cover_id);

      self.attachmentsArea.html(
        N.runtime.render('mdedit.attachments', { attachments: self.attachments })
      );
    });
  };
});
