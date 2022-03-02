'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdHeading = function (editor) {
    let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
    let lineEnd = editor.value.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = editor.value.length;

    let selectedText = editor.value.slice(lineStart, lineEnd);
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

    editor.setRangeText(
      selectedText.replace(regExp, replace),
      lineStart,
      lineEnd,
      'end'
    );
    editor.dispatchEvent(new Event('change'));
  };
});
