// Add editor class to 'N' & emit event for plugins
//
// options:
// - editArea - CSS selector of editor container div
// - previewArea - CSS selector of preview container div
// - attachments - array of attachments
// - text - source markdown text
// - parseRules - config for parser
//   - cleanupRules
//   - smiles
//   - medialinkProviders
// - toolbarButtons - list of buttons for toolbar
// - onChange - event fires when `markdown` or `attachments` changed
//
// getters/setters:
// - attachments() - array of attachments
// - text() - user input markdown text
//

/*global ace*/

'use strict';

var _ = require('lodash');


var TEXT_MARGIN = 5;

// Unique editor id to bind wire events (incremented)
var editorId = 0;


function MDEdit(options) {
  var $editorArea = $(options.editArea);

  this.editorId = editorId++;

  $editorArea.append(N.runtime.render('mdedit', {
    buttons: options.toolbarButtons,
    editorId: this.editorId
  }));

  this.preview = $(options.previewArea);
  this.editArea = $editorArea.find('.mdedit__edit-area');
  this.ace = ace.edit(this.editArea.get(0));
  this.toolbar = $editorArea.find('.mdedit-toolbar');
  this.attachmentsArea = $editorArea.find('.mdedit__attachments');
  this.resize = $editorArea.find('.mdedit__resizer');
  this.editorContainer = $editorArea.find('.mdedit');

  this.ace.renderer.scrollMargin.top = TEXT_MARGIN;
  this.ace.renderer.scrollMargin.bottom = TEXT_MARGIN;

  this.options = options;

  this._initAce();
  this._initToolbar();
  this._initResize();
  this._initAttachmentsArea();


  // Set initial value
  this.text(options.text || '');
  this.attachments(options.attachments || []);
}


// Set initial Ace options
//
MDEdit.prototype._initAce = function () {
  var aceSession = this.ace.getSession();

  aceSession.setMode('ace/mode/markdown');

  this.ace.setOptions({
    showLineNumbers: false,
    showGutter: false,
    highlightActiveLine: false
  });

  aceSession.setUseWrapMode(true);

  aceSession.on('change', this._updatePreview.bind(this));

  if (this.options.onChange) {
    aceSession.on('change', this.options.onChange);
  }

  this.ace.focus();
};


// Added attachments bar event handlers
//
MDEdit.prototype._initAttachmentsArea = function () {
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
            var attachments = self.attachments();

            uploaderData.uploaded.forEach(function (media) {
              attachments.unshift(_.pick(media, [ 'media_id', 'file_name', 'type' ]));
            });

            self.attachments(attachments);
          });
        }
        break;
      default:
    }
  });

  // Remove attachment handler
  N.wire.on('mdedit.attachments:remove', function remove_attachment(event) {
    var $target = $(event.currentTarget);

    if ($target.data('editor-id') !== self.editorId) {
      event.stopPropagation();
      return;
    }

    var id = $target.data('media-id');
    var attachments = self.attachments();

    attachments = _.remove(attachments, function (val) { return val.media_id !== id; });
    self.attachments(attachments);

    self.ace.find(
      new RegExp('\\!?\\[[^\\]]*\\]\\([^)]*?' + id + '[^)]*\\)', 'gm'),
      { regExp: true }
    );
    self.ace.replaceAll('');

    // Reset selection
    self.ace.setValue(self.ace.getValue(), 1);

    event.stopPropagation();
  });

  // Click on attachment to insert into text
  N.wire.on('mdedit.attachments:insert', function insert_attachment(event) {
    var mTypes = '$$ JSON.stringify(N.models.users.MediaInfo.types) $$';
    var $target = $(event.currentTarget);

    if ($target.data('editor-id') !== self.editorId) {
      event.stopPropagation();
      return;
    }

    var id = $target.data('media-id');
    var type = $target.data('type');
    var name = $target.data('file-name');
    var url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: id });

    if (type === mTypes.IMAGE) {
      self.ace.insert('![](' + url + ')');
    } else {
      self.ace.insert('[' + name + '](' + url + ')');
    }

    self.ace.focus();

    event.stopPropagation();
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

      // Restore focus on editor after command execution
      self.ace.focus();
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
MDEdit.prototype._updatePreview = _.debounce(function () {
  var self = this;
  var mdData = { input: this.text(), output: null };

  N.parser.md2src(mdData, function () {
    var srcData = {
      input: mdData.output,
      output: null,
      options: self.options.parseRules
    };

    N.parser.src2ast(srcData, function () {
      var insertedAttachments = [];

      // Find all attachments inserted to text
      srcData.output.find('img[data-nd-media-id], a[data-nd-media-id]').each(function () {
        insertedAttachments.push($(this).data('nd-media-id'));
      });

      // Get all attachments except inserted to text
      var attachTail = self.attachments().filter(function (attach) {
        return insertedAttachments.indexOf(attach.media_id) === -1;
      });

      self.preview.html(N.runtime.render('mdedit.preview', {
        user_hid: N.runtime.user_hid,
        html: srcData.output.html(),
        attachments: attachTail
      }));
    });
  });
}, 500, { maxWait: 500 });


MDEdit.prototype.text = function (text) {
  if (!text) {
    return this.ace.getValue();
  }

  this.ace.setValue(text, -1);
  this._updatePreview();
};


MDEdit.prototype.attachments = function (attachments) {
  if (!attachments) {
    return this._attachments;
  }

  this._attachments = attachments;
  this._updateAttachments();

  if (this.options.onChange) {
    this.options.onChange();
  }
};


// Update attachments panel
//
MDEdit.prototype._updateAttachments = function () {
  if (this.attachments().length > 0) {
    this.editorContainer.removeClass('no-attachments');
  } else {
    this.editorContainer.addClass('no-attachments');
  }

  this.attachmentsArea.html(
    N.runtime.render('mdedit.attachments', { attachments: this.attachments(), editor_id: this.editorId })
  );

  this._updatePreview();
};


MDEdit.prototype.commands = {};


N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = MDEdit;

  N.wire.emit('init:mdedit', {}, callback);
});
