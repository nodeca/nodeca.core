'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdHeading = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var selectedText = document.getLine(range.start.row);
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

    document.replace({
      start: {
        column: 0,
        row: range.start.row
      },
      end: {
        column: selectedText.length,
        row: range.start.row
      }
    }, selectedText.replace(regExp, replace));
  };
});
