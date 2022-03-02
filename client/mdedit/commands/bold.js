'use strict';

N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdBold = function (editor) {
    let selectionStart = editor.selectionStart;
    let selectionEnd = editor.selectionEnd;
    if (selectionStart === selectionEnd) return;

    let add = '__';
    let replacement = add + editor.value.slice(selectionStart, selectionEnd) + add;

    editor.setRangeText(replacement, selectionStart, selectionEnd);
    editor.dispatchEvent(new Event('change'));

    selectionStart += add.length;
    selectionEnd += add.length;
    editor.setSelectionRange(selectionStart, selectionEnd);
  };
});
