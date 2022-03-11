'use strict';


const text_field_update = require('../_lib/text_field_update');


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdItalic = function (editor) {
    // TODO: copypaste from cmd_bold
    if (editor.selectionStart === editor.selectionEnd) return;

    text_field_update.wrapSelection(editor, '*');
  };
});
