'use strict';

var _ = require('lodash');

N.wire.once('init:mdedit', function () {
  N.MDEdit.prototype.commands.cmdCut = function (editor) {
    var range = editor.getSelectionRange();
    var document = editor.getSession().getDocument();
    var selectedText = editor.getSession().getTextRange(range);
    var tpl = '\n{% cut <%= text %> %}\n';

    if (range.end.column === range.start.column && range.end.row === range.start.row) {
      document.insert(range.start, _.template(tpl, { text: t('@mdedit.toolbar.cut_text') }));
    } else {
      document.replace(range, _.template(tpl, { text: selectedText }));
    }
  };
});
