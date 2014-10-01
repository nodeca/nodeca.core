// Add editor class to 'N' & emit event for plugins
//

/*global ace, $*/

'use strict';

var _ = require('lodash');

function MDEdit(options) {
  var self = this;
  var $editorArea = $(options.editor_area);
  var $button;

  $editorArea.append(N.runtime.render('mdedit.layout'));

  this.preview = $(options.preview_area);
  this.editor = ace.edit($editorArea.find('.mdedit__editor').get(0));
  this.toolbar = $editorArea.find('.mdedit__toolbar');
  this.parseRules = options.parse_rules;

  this.editor.getSession().setMode('ace/mode/markdown');
  this.editor.getSession().on('change', _.debounce(function () {
    self.updatePreview();
  }, 500));

  var clickHandler = function () {
    var event = self.events[$(this).data('event')];

    if (event) {
      event(self.editor);
    }
  };

  options.toolbar_buttuns.forEach(function (button) {
    $button = $('<div>');

    if (button.css_class) {
      $button.attr('class', button.css_class + ' mdedit-toolbar__item');
    }

    if (button.tooltip) {
      $button.attr('title', t(button.tooltip));
    }

    if (button.event) {
      $button.data('event', button.event);
      $button.click(clickHandler);

      if (button.bind_key && self.events[button.event]) {
        self.editor.commands.addCommand({
          name: button.event,
          bindKey: button.bind_key,
          exec: self.events[button.event]
        });
      }
    }

    self.toolbar.append($button);
  });
}


MDEdit.prototype.events = {};


MDEdit.prototype.events.cmd_cut = function (editor) {
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


MDEdit.prototype.events.cmd_h = function (editor) {
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


MDEdit.prototype.events.cmd_ol = function (editor) {
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var selectedText = editor.getSession().getTextRange(range);
  var lineStartRegexp = /^ *[0-9]+\. /;

  if (range.end.column === range.start.column && range.end.row === range.start.row) {
    if (!lineStartRegexp.test(document.getLine(range.start.row))) {
      document.insert({ column: 0, row: range.start.row }, '1. ');
    }
  } else {
    var i = 1;

    document.replace(range, selectedText.split('\n').map(function (line) {
      if (lineStartRegexp.test(line)) {
        return line;
      }

      return i++ + '. ' + line;
    }).join('\n'));
  }
};


MDEdit.prototype.events.cmd_ul = function (editor) {
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var selectedText = editor.getSession().getTextRange(range);
  var lineStartRegexp = /^ *- /;

  if (range.end.column === range.start.column && range.end.row === range.start.row) {
    if (!lineStartRegexp.test(document.getLine(range.start.row))) {
      document.insert({ column: 0, row: range.start.row }, '- ');
    }
  } else {
    document.replace(range, selectedText.split('\n').map(function (line) {
      if (lineStartRegexp.test(line)) {
        return line;
      }

      return '- ' + line;
    }).join('\n'));
  }
};


MDEdit.prototype.events.cmd_spoiler = function (editor) {
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var tpl = '\n``` spoiler <%= title %>\n<%= text %>\n```\n';

  if (range.end.column === range.start.column && range.end.row === range.start.row) {
    document.insert(range.end, _.template(tpl, {
      title: t('@mdedit.toolbar.spoiler_title'),
      text: t('@mdedit.toolbar.spoiler_text')
    }));
  } else {
    document.replace(range, _.template(tpl, {
      title: t('@mdedit.toolbar.spoiler_title'),
      text: editor.getSession().getTextRange(range)
    }));
  }
};


MDEdit.prototype.events.cmd_huperlink = function (editor) {
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var $linkDialog = $(N.runtime.render('mdedit.toolbar.huperlink'));
  var tpl = '[<%= desc %>](<%= url %>)';

  $('body').append($linkDialog);
  $linkDialog.modal('show');

  $linkDialog.on('hidden.bs.modal', function () {
    $linkDialog.remove();
  });

  $linkDialog.find('.huperlink-dialog__apply').click(function () {
    var url = $linkDialog.find('.huperlink-dialog__input').val();

    $linkDialog.modal('hide');

    if (range.end.column === range.start.column && range.end.row === range.start.row) {
      document.insert(range.end, _.template(tpl, {
        desc: t('@mdedit.toolbar.huperlink.description'),
        url: url
      }));
    } else {
      document.replace(range, _.template(tpl, {
        desc: editor.getSession().getTextRange(range),
        url: url
      }));
    }
  });
};


MDEdit.prototype.events.cmd_help = function () {
  var $helpDialog = $(N.runtime.render('mdedit.toolbar.help'));

  $('body').append($helpDialog);
  $helpDialog.modal('show');

  $helpDialog.on('hidden.bs.modal', function () {
    $helpDialog.remove();
  });
};


MDEdit.prototype.events.cmd_bold = function (editor) {
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var selection = editor.getSelection();
  var add = '__';

  if (range.end.column === range.start.column && range.end.row === range.start.row) {
    return;
  }

  document.insert(range.end, add);
  document.insert(range.start, add);

  selection.clearSelection();
  selection.moveCursorTo(range.start.row, range.start.column + add.length);
  selection.selectTo(range.end.row, range.end.column + add.length);
};


MDEdit.prototype.events.cmd_italic = function (editor) {
  // TODO: copypaste from cmd_bold
  var range = editor.getSelectionRange();
  var document = editor.getSession().getDocument();
  var selection = editor.getSelection();
  var add = '_';

  if (range.end.column === range.start.column && range.end.row === range.start.row) {
    return;
  }

  document.insert(range.end, add);
  document.insert(range.start, add);

  selection.clearSelection();
  selection.moveCursorTo(range.start.row, range.start.column + add.length);
  selection.selectTo(range.end.row, range.end.column + add.length);
};


MDEdit.prototype.updatePreview = function () {
  var self = this;

  this.getSrc(function (src) {
    var parserData = {
      input: src,
      output: null,
      options: self.parseRules
    };

    N.parser.src2ast(parserData, function () {
      self.preview.html(parserData.output.html());
    });
  });
};


MDEdit.prototype.getSrc = function (callback) {
  var mdData = { input: this.editor.getValue(), output: null };

  N.parser.md2src(mdData, function () {
    callback(mdData.output);
  });
};


MDEdit.prototype.setSrc = function (src) {
  var self = this;
  var srcData = { input: src, output: null };

  N.parser.src2md(srcData, function () {
    self.editor.setValue(srcData.output);
  });
};


N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = MDEdit;

  N.wire.emit('init:mdedit', {}, callback);
});
