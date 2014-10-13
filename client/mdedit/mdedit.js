// Add editor class to 'N' & emit event for plugins
//
// options:
// - editArea - CSS selector of editor container div
// - previewArea - CSS selector of preview container div
// - attachments - array of attachments
// - markdown - source markdown text
// - parseRules - config for parser
//   - cleanupRules
//   - smiles
//   - medialinkProviders
// - toolbarButtons - list of buttons for toolbar
//
// readonly properties:
// - attachments - array of attachments
// - markdown - user input markdown text
//

/*global ace*/

'use strict';

var _ = require('lodash');


// Unique editor id to bind wire events (incremented)
var id = 0;


function MDEdit(options) {
  var $editorArea = $(options.editArea);

  this.editorId = id++;

  $editorArea.append(N.runtime.render('mdedit', {
    buttons: options.toolbarButtons,
    editorId: this.editorId
  }));

  this.preview = $(options.previewArea);
  this.editArea = $editorArea.find('.mdedit__edit-area');
  this.ace = ace.edit(this.editArea.get(0));
  this.toolbar = $editorArea.find('.mdedit__toolbar');
  this.attachmentsArea = $editorArea.find('.mdedit__attachments');
  this.resize = $editorArea.find('.mdedit__resize');
  this.dropHelp = $editorArea.find('.mdedit__drop-help');
  this.editorContainer = $editorArea.find('.mdedit');

  this.options = options;

  this._initAce();
  this._initToolbar();
  this._initResize();
  this._initAttachmentsArea();


  // Set initial value
  this.ace.setValue(options.markdown || '');
  this.attachments = options.attachments || [];

  this._updatePreview();
  this._updateAttachments();
}


// Set initial Ace options
//
MDEdit.prototype._initAce = function () {
  var self = this;

  this.ace.getSession().setMode('ace/mode/markdown');

  this.ace.setOptions({
    showLineNumbers: false,
    showGutter: false,
    highlightActiveLine: false
  });

  this.ace.getSession().setUseWrapMode(true);

  this.ace.getSession().on('change', _.debounce(function () {
    self.markdown = self.ace.getValue();
    self._updatePreview();
  }, 500));
};


// Added attachments bar event handlers
//
MDEdit.prototype._initAttachmentsArea = function () {
  var attachEvent = this.commands.cmdAttach.bind(this);
  var self = this;

  N.wire.on('core.mdedit:dd_' + this.editorId, function mdedit_dd(event) {
    var x0, y0, x1, y1, ex, ey, uploaderData;

    switch (event.type) {
      case 'dragenter':
        self.editorContainer.addClass('active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = self.editorContainer.offset().left;
        y0 = self.editorContainer.offset().top;
        x1 = x0 + self.editorContainer.outerWidth();
        y1 = y0 + self.editorContainer.outerHeight();
        ex = event.originalEvent.pageX;
        ey = event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          self.editorContainer.removeClass('active');
        }
        break;
      case 'drop':
        self.editorContainer.removeClass('active');

        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {

          uploaderData = {
            files: event.dataTransfer.files,
            url: N.router.linkTo('users.media.upload'),
            config: 'users.uploader_config',
            uploaded: null
          };

          N.wire.emit('users.uploader:add', uploaderData, function () {
            uploaderData.uploaded.forEach(function (media) {
              self.attachments.unshift(media.file_id);
            });

            self._updateAttachments();
          });
        }
        break;
      default:
    }
  });

  // Click to drop help to select file from gallery
  this.dropHelp.click(function () {
    attachEvent(self);
  });

  // Remove button on attachment
  this.attachmentsArea.on('click', '.mdedit__attach-remove', function () {
    var id = $(this).data('attach-id');
    var $attach = self.attachmentsArea.find('#mdedit__attach-item-' + id);

    self.attachments = _.remove(self.attachments, function (val) { return val !== id; });

    $attach.remove();

    self.ace.find(
      new RegExp('\\!\\[[^\\]]*\\]\\([^)]*?' + id + '[^)]*\\)', 'gm'),
      { regExp: true }
    );
    self.ace.replaceAll('');

    return false;
  });

  // Click on attachment to insert into text
  this.attachmentsArea.on('click', '.mdedit__attach-item', function () {
    var $attach = $(this);
    var id = $attach.data('attach-id');

    if (!id) {
      return;
    }

    var imageUrl = N.router.linkTo('core.gridfs', { 'bucket': id + '_sm' });

    self.ace.insert('![](' + imageUrl + ')');
  });
};


// Add editor resize handler
//
MDEdit.prototype._initResize = function () {
  var minHeight = parseInt(this.editArea.height(), 10);
  var self = this;
  var $body = $('body');

  this.resize.on('mousedown touchstart', function (event) {
    var clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    var currentHeight = parseInt(self.editArea.height(), 10);

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
        var newHeight = currentHeight + (point.pageY - clickStart.pageY);

        self.editArea.height(newHeight > minHeight ? newHeight : minHeight);
        self.ace.resize();

      }, 20, { maxWait: 20 }));
  });
};


// Create toolbar with buttons and bind events
//
MDEdit.prototype._initToolbar = function () {
  var self = this;

  this.toolbar.on('click', '.mdedit-toolbar__item', function () {
    var command = self.commands[$(this).data('command')].bind(self);

    if (command) {
      command(self.ace);
    }
  });


  this.options.toolbarButtons.forEach(function (button) {
    if (!button.command || !button.bind_key || !self.commands[button.command]) {
      return;
    }

    self.ace.commands.addCommand({
      name: button.command,
      bindKey: button.bind_key,
      exec: self.commands[button.command].bind(self)
    });
  });
};


// Set options
//
MDEdit.prototype.setOptions = function (options) {
  this.options = _.assign(this.options, options);
  this._updatePreview();
};


// Update editor preview
//
MDEdit.prototype._updatePreview = function () {
  var self = this;
  var mdData = { input: this.ace.getValue(), output: null };

  N.parser.md2src(mdData, function () {
    var srcData = {
      input: mdData.output,
      output: null,
      options: self.options.parseRules
    };

    N.parser.src2ast(srcData, function () {
      self.preview.html(srcData.output.html());
    });
  });
};


// Update attachments panel
//
MDEdit.prototype._updateAttachments = function () {
  this.attachmentsArea.html(
    N.runtime.render('mdedit.attachments', { attachments: this.attachments })
  );
};


MDEdit.prototype.commands = {};


N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = MDEdit;

  N.wire.emit('init:mdedit', {}, callback);
});
