'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdHeading = function (editor) {
    var selectionStart = editor.getCursor(true);
    // var selectionEnd = editor.getCursor(false);

    var selectedText = editor.getLine(selectionStart.line);
    var regExp = /^(#*) ?/;
    var headerStart = selectedText.match(regExp);

    var level = headerStart ? headerStart[0].length : 0;

    if (level === 0 || level > 3) {
      level = 1;
    }

    var replace = '';

    for (var i = 0; i < level; i++) {
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
