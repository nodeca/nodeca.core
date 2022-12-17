'use strict';


const text_field_update = require('../_lib/text_field_update');


N.wire.once('init:mdedit', function () {
  N.MDEdit.commands.cmdQuote = function (editor) {
    text_field_update.wrapSelection(editor, '\n```quote\n', '\n```\n');
  };
});
