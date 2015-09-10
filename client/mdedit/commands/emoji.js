'use strict';


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdEmoji = function (editor) {
    var $emojiDialog = $(N.runtime.render('mdedit.emoji_dlg', { emojis: N.MDEdit.emojis.named }));

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
