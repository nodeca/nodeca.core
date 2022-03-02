'use strict';


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdEmoji = function (editor) {
    let emojis = {};

    for (let [ name, emoji ] of Object.entries(N.MDEdit.emojis.named)) {
      if (!emojis[emoji]) {
        emojis[emoji] = {
          name,
          aliases: [ ':' + name + ':' ].concat(N.MDEdit.emojis.aliases[name] || [])
        };

      } else {
        emojis[emoji].aliases.push(':' + name + ':');
      }
    }

    let $emojiDialog = $(N.runtime.render('mdedit.emoji_dlg', { emojis }));

    $('body').append($emojiDialog);
    $emojiDialog.modal('show');

    $emojiDialog.on('hidden.bs.modal', function () {
      $emojiDialog.remove();
    });

    $emojiDialog.find('.emoji-dlg__item-link').click(function () {
      let value = $(this).data('value');

      $emojiDialog.modal('hide');

      editor.setRangeText(':' + value + ':', editor.selectionStart, editor.selectionEnd);
      editor.dispatchEvent(new Event('change'));
      editor.focus();
    });
  };
});
