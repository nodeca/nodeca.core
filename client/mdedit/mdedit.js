// Add editor class to 'N' & emit event for plugins
//
// options:
// - editArea - CSS selector of editor container div
// - previewArea - CSS selector of preview container div
// - attachments - array of attachments
// - text - source markdown text
// - parseOptions - object with plugins config like `{ images: true, links: true, attachments: false }`
// - onChange - event fires when `markdown` or `attachments` changed
// - toolbar - name of toolbar config - `default` by default
//
// methods:
// - setOptions - update options
//
// getters/setters:
// - attachments() - array of attachments
// - text() - user input markdown text
//

/*global ace*/

'use strict';

var _ = require('lodash');


var TEXT_MARGIN = 5;
var TOOLBAR = '$$ JSON.stringify(N.config.mdedit) $$';


// Unique editor id to bind wire events (incremented)
var editorId = 0;


var compileToolbarConfig = _.memoize(function (name) {
  var buttonName;

  return _.reduce(TOOLBAR[name], function (result, buttonParams, key) {
    if (!buttonParams) {
      return result;
    }

    buttonName = key.indexOf('separator') === 0 ? 'separator' : key;

    if (buttonParams === true) {
      result.push(TOOLBAR.buttons[buttonName]);
    } else {
      result.push(_.defaults({}, buttonParams, TOOLBAR.buttons[buttonName]));
    }

    return result;
  }, []).sort(function (a, b) {
    return a.priority - b.priority;
  });
});


function MDEdit(options) {
  var $editorArea = $(options.editArea);

  this.__editorId__ = editorId++;

  $editorArea.append(N.runtime.render('mdedit', {
    editorId: this.__editorId__
  }));

  this.__preview__ = $(options.previewArea);
  this.__editArea__ = $editorArea.find('.mdedit__edit-area');
  this.__ace__ = ace.edit(this.__editArea__.get(0));
  this.__toolbar__ = $editorArea.find('.mdedit-toolbar');
  this.__attachmentsArea__ = $editorArea.find('.mdedit__attachments');
  this.__resize__ = $editorArea.find('.mdedit__resizer');
  this.__editorContainer__ = $editorArea.find('.mdedit');
  this.__toolbarConfig__ = compileToolbarConfig(options.toolbar || 'default');
  this.options = options;

  this.__ace__.renderer.scrollMargin.top = TEXT_MARGIN;
  this.__ace__.renderer.scrollMargin.bottom = TEXT_MARGIN;

  this.__initAce__();
  this.__initResize__();
  this.__initAttachmentsArea__();
  this.__initToolbar__();

  this.__updateToolbar__();

  // Set initial value
  this.text(options.text || '');
  this.attachments(options.attachments || []);
}


// Set initial Ace options
//
MDEdit.prototype.__initAce__ = function () {
  var aceSession = this.__ace__.getSession();

  aceSession.setMode('ace/mode/markdown');

  this.__ace__.setOptions({
    showLineNumbers: false,
    showGutter: false,
    highlightActiveLine: false
  });

  aceSession.setUseWrapMode(true);

  aceSession.on('change', this.__updatePreview__.bind(this));

  if (this.options.onChange) {
    aceSession.on('change', this.options.onChange);
  }

  this.__ace__.focus();
};


// Added attachments bar event handlers
//
MDEdit.prototype.__initAttachmentsArea__ = function () {
  var self = this;

  N.wire.on('core.mdedit:dd_' + this.__editorId__, function mdedit_dd(event) {
    var x0, y0, x1, y1, ex, ey, uploaderData;

    switch (event.type) {
      case 'dragenter':
        self.__editorContainer__.addClass('active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = self.__editorContainer__.offset().left;
        y0 = self.__editorContainer__.offset().top;
        x1 = x0 + self.__editorContainer__.outerWidth();
        y1 = y0 + self.__editorContainer__.outerHeight();
        ex = event.originalEvent.pageX;
        ey = event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          self.__editorContainer__.removeClass('active');
        }
        break;
      case 'drop':
        self.__editorContainer__.removeClass('active');

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

    if ($target.data('editor-id') !== self.__editorId__) {
      event.stopPropagation();
      return;
    }

    var id = $target.data('media-id');
    var attachments = self.attachments();

    attachments = _.remove(attachments, function (val) { return val.media_id !== id; });
    self.attachments(attachments);

    self.__ace__.find(
      new RegExp('\\!?\\[[^\\]]*\\]\\([^)]*?' + id + '[^)]*\\)', 'gm'),
      { regExp: true }
    );
    self.__ace__.replaceAll('');

    // Reset selection
    self.__ace__.setValue(self.__ace__.getValue(), 1);

    event.stopPropagation();
  });

  // Click on attachment to insert into text
  N.wire.on('mdedit.attachments:insert', function insert_attachment(event) {
    var $target = $(event.currentTarget);

    if ($target.data('editor-id') !== self.__editorId__) {
      event.stopPropagation();
      return;
    }

    var url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: $target.data('media-id') });

    self.__ace__.insert('![](' + url + ')');
    self.__ace__.focus();

    event.stopPropagation();
  });
};


// Add editor resize handler
//
MDEdit.prototype.__initResize__ = function () {
  var minHeight = parseInt(this.__editArea__.height(), 10);
  var self = this;
  var $body = $('body');

  this.__resize__.on('mousedown touchstart', function (event) {
    var clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    var currentHeight = parseInt(self.__editArea__.height(), 10);

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
        var newHeight = currentHeight + (point.pageY - clickStart.pageY);

        self.__editArea__.height(newHeight > minHeight ? newHeight : minHeight);
        self.__ace__.resize();

      }, 20, { maxWait: 20 }));
  });
};


// Add toolbar click handler
//
MDEdit.prototype.__initToolbar__ = function () {
  var self = this;

  this.__toolbar__.on('click', '.mdedit-toolbar__item', function () {
    var command = self.commands[$(this).data('command')].bind(self);

    if (command) {
      command(self.__ace__);

      // Restore focus on editor after command execution
      self.__ace__.focus();
    }
  });
};


// Update toolbar button list
//
MDEdit.prototype.__updateToolbar__ = function () {
  var self = this;

  // Get actual buttons
  var buttons = _.reduce(this.__toolbarConfig__, function (result, btn) {

    // If parser plugin inactive - remove button
    if (self.options.parseOptions[btn.depend] === false) {
      return result;
    }

    // If duplicate separator - remove it
    if (btn.separator && result.length > 0 && result[result.length - 1].separator) {
      return result;
    }

    result.push(btn);

    return result;
  }, []);

  // If first item is separator - remove
  if (buttons.length > 0 && buttons[0].separator) {
    buttons.shift();
  }

  // If last item is separator - remove
  if (buttons.length > 0 && buttons[buttons.length - 1].separator) {
    buttons.pop();
  }

  // Render toolbar
  this.__toolbar__.html(N.runtime.render('mdedit.toolbar', {
    buttons: buttons
  }));

  // Disable all hotkeys
  this.__ace__.commands.removeCommands(Object.keys(this.commands));

  // Enable active button's hotkeys
  buttons.forEach(function (button) {
    if (!button.command || !button.bind_key || !self.commands[button.command]) {
      return;
    }

    self.__ace__.commands.addCommand({
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
  this.__updateToolbar__();
  this.__updatePreview__();
};


// Update editor preview
//
MDEdit.prototype.__updatePreview__ = _.debounce(function () {
  var self = this;

  N.parse(
    {
      text: this.text(),
      attachments: self.attachments(),
      options: self.options.parseOptions
    },
    function (err, result) {
      if (err) {
        // TODO: notify about err
        return;
      }

      self.__preview__.html(N.runtime.render('mdedit.preview', {
        user_hid: N.runtime.user_hid,
        html: result.html,
        attachments: result.tail
      }));
    }
  );

}, 500, { maxWait: 500 });


MDEdit.prototype.text = function (text) {
  if (!text) {
    return this.__ace__.getValue();
  }

  this.__ace__.setValue(text, -1);
  this.__updatePreview__();
};


MDEdit.prototype.attachments = function (attachments) {
  if (!attachments) {
    return this._attachments;
  }

  this._attachments = attachments;
  this.__updateAttachments__();

  if (this.options.onChange) {
    this.options.onChange();
  }
};


// Update attachments panel
//
MDEdit.prototype.__updateAttachments__ = function () {
  if (this.attachments().length > 0) {
    this.__editorContainer__.removeClass('no-attachments');
  } else {
    this.__editorContainer__.addClass('no-attachments');
  }

  this.__attachmentsArea__.html(
    N.runtime.render('mdedit.attachments', { attachments: this.attachments(), editor_id: this.__editorId__ })
  );

  this.__updatePreview__();
};


MDEdit.prototype.commands = {};


N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = MDEdit;

  N.wire.emit('init:mdedit', {}, callback);
});
