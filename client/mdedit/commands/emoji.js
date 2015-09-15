'use strict';


var _ = require('lodash');


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdEmoji = function (editor) {
    var emojis = _.reduce(N.MDEdit.emojis.named, function (acc, emoji, name) {
      if (!acc[emoji]) {
        acc[emoji] = {
          name: name,
          aliases: [ ':' + name + ':' ].concat(N.MDEdit.emojis.aliases[name] || [])
        };

      } else {
        acc[emoji].aliases.push(':' + name + ':');
      }

      return acc;
    }, {});

    var $emojiDialog = $(N.runtime.render('mdedit.emoji_dlg', { emojis: emojis }));

    $('body').append($emojiDialog);
    $emojiDialog.modal('show');

    $emojiDialog.on('hidden.bs.modal', function () {
      $emojiDialog.remove();
    });

    $emojiDialog.find('.emoji-dlg__item-link').click(function () {
      var value = $(this).data('value');

      $emojiDialog.modal('hide');

      editor.replaceSelection(':' + value + ':');

      editor.focus();
    });
  };
});
