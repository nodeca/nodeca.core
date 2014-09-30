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


MDEdit.prototype.events.cmd_help = function () {
  var $helpDialog = $(N.runtime.render('mdedit.help'));

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
