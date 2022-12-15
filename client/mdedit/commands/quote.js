'use strict';


const md_writer         = require('nodeca.core/lib/parser/md_writer');
const text_field_update = require('../_lib/text_field_update');


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdQuote = function (editor) {
    if (editor.selectionStart !== editor.selectionEnd) {
      let pos;
      let selectionStart = editor.selectionStart;
      pos = editor.value.lastIndexOf('\n', selectionStart - 1);
      selectionStart = pos === -1 ? 0 : pos + 1;

      let selectionEnd = editor.selectionEnd;
      pos = editor.value.indexOf('\n', selectionEnd);
      selectionEnd = pos === -1 ? editor.value.length : pos;

      let selectedText = editor.value.slice(selectionStart, selectionEnd);

      editor.selectionStart = selectionStart;
      editor.selectionEnd   = selectionEnd;

      let writer = new md_writer.NodecaMarkdownWriter();
      let insertion = writer.format_quote(selectedText, null).replace(/^\n*/g, '');

      text_field_update.insert(editor, insertion);
    }
  };
});
