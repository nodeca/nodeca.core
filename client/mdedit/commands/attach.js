'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdAttach = function () {
    // TODO: show real dialog
    // TODO: move this method to nodeca.users

    var self = this;

    var data = { user_hid: 1, album_id: '543ce3af61c87a71b3ae196e', cover_id: null };
    N.wire.emit('users.album.edit.select_cover', data, function () {

      if (_.findIndex(self.attachments, function (attach) { return attach.id === data.cover_id; }) !== -1) {
        // attachment already exists
        return;
      }

      self.attachments.unshift({ id: data.cover_id, name: '' });

      self._updateAttachments();
    });
  };
});
