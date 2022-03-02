'use strict';

const _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdAttach = function (editor) {
    // TODO: move this method to nodeca.users

    let data = {};
    let tpl = _.template('![<%= alt %>](<%= url %>)');

    return Promise.resolve()
      .then(() => N.loader.loadAssets('users'))
      .then(() => N.wire.emit('users.blocks.media_select_dlg', data, () => {
        if (!data.selected.length) return;

        let str = data.selected.map(media => {
          let url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: media.media_id });

          return tpl({ alt: '', url });
        }).join(' ');

        editor.setRangeText(str, editor.selectionStart, editor.selectionEnd);
        editor.dispatchEvent(new Event('change'));
        editor.focus();
      }));
  };
});
