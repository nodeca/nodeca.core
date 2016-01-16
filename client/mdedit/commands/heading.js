'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdHeading = function (editor) {
    let selectionStart = editor.getCursor(true);
    // let selectionEnd = editor.getCursor(false);

    let selectedText = editor.getLine(selectionStart.line);
    let regExp = /^(#*) ?/;
    let headerStart = selectedText.match(regExp);

    let level = headerStart ? headerStart[0].length : 0;

    if (level === 0 || level > 3) {
      level = 1;
    }

    let replace = '';

    for (let i = 0; i < level; i++) {
      replace += '#';
    }
    replace += ' ';

    editor.replaceRange(
      selectedText.replace(regExp, replace),
      { ch: 0, line: selectionStart.line },
      { ch: selectedText.length, line: selectionStart.line }
    );
  };
});
