'use strict';


const _ = require('lodash');


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdEmoji = function (editor) {
    let emojis = _.reduce(N.MDEdit.emojis.named, (acc, emoji, name) => {
      if (!acc[emoji]) {
        acc[emoji] = {
          name,
          aliases: [ ':' + name + ':' ].concat(N.MDEdit.emojis.aliases[name] || [])
        };

      } else {
        acc[emoji].aliases.push(':' + name + ':');
      }

      return acc;
    }, {});

    let $emojiDialog = $(N.runtime.render('mdedit.emoji_dlg', { emojis }));

    $('body').append($emojiDialog);
    $emojiDialog.modal('show');

    $emojiDialog.on('hidden.bs.modal', function () {
      $emojiDialog.remove();
    });

    $emojiDialog.find('.emoji-dlg__item-link').click(function () {
      let value = $(this).data('value');

      $emojiDialog.modal('hide');

      editor.replaceSelection(':' + value + ':');

      editor.focus();
    });
  };
});
