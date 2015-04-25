// Add editor instance to 'N' & emit event for plugins
//


/*global ace*/

'use strict';

var _ = require('lodash');


var TEXT_MARGIN = 5;
var TOOLBAR = '$$ JSON.stringify(N.config.mdedit) $$';


// Compile toolbar config
//
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


// Editor init
//
function MDEdit() {
  this.commands = {};
  this.__attachments__ = [];
  this.__options__ = null;
  this.__layout__ = null;
  this.__minHeight__ = 0;
}


// Create new layout and show
//
// Options:
//
// - parseOptions (Object) - optional, object with plugins config like
//   `{ images: true, links: true, attachments: false }`, default `{}`
// - text (String) - optional, text, default empty string
// - attachments (Array) - optional, attachments, default empty array
// - toolbar (String) - optional, name of toolbar config, default `default`
//
// returns jQuery object
//
// Events:
//
// - `show.nd.mdedit` - before editor shown (when animation start)
// - `shown.nd.mdedit` - on editor shown
// - `hide.nd.mdedit` - before editor hide (when animation start)
// - `hidden.nd.mdedit` - on editor hide
// - `submit.nd.mdedit` - on done button press (if you want to prevent editor closing - call `event.preventDefault()`)
// - `change.nd.mdedit` - on update preview, you can save drafts on this event
//
MDEdit.prototype.show = function (options) {
  var self = this;
  var $oldLayout = this.__layout__;

  this.__layout__ = $(N.runtime.render('mdedit'));
  this.__options__ = _.clone(options);
  this.__options__.toolbar = compileToolbarConfig(this.__options__.toolbar || 'default');
  this.__options__.parseOptions = this.__options__.parseOptions || {};

  $('body').append(this.__layout__);

  this.__initAce__();
  this.__initResize__();
  this.__initToolbar__();

  this.text(options.text || '');
  this.attachments(options.attachments || []);

  setTimeout(function () {
    self.__layout__.trigger('show');
    self.__layout__.animate({ bottom: 0 }, $oldLayout ? 0 : 'fast', function () {
      self.__layout__.trigger('shown');

      // Hide previous editor
      if ($oldLayout) {
        $oldLayout.trigger('hide');
        $oldLayout.trigger('hidden');
        $oldLayout.remove();
      }

      self.__ace__.resize();
    });
  }, 0);

  return this.__layout__;
};


// Hide editor
//
MDEdit.prototype.hide = function () {
  var self = this;
  var $layout = this.__layout__;

  if (!$layout) {
    return;
  }

  setTimeout(function () {
    $layout.trigger('hide');
    $layout.animate({ bottom: -$layout.height() }, 'fast', function () {
      self.__layout__ = null;
      $layout.trigger('hidden');
      $layout.remove();
    });
  }, 0);
};


// Get/set text
//
MDEdit.prototype.text = function (text) {
  if (!text) {
    return this.__ace__.getValue();
  }

  this.__ace__.setValue(text, -1);

  this.__updatePreview__();
};


// Get/set attachments
//
MDEdit.prototype.attachments = function (attachments) {
  if (!attachments) {
    return this.__attachments__;
  }

  this.__attachments__ = attachments;

  if (this.__attachments__.length === 0) {
    this.__layout__.addClass('mdedit__m-no-attachments');
  } else {
    this.__layout__.removeClass('mdedit__m-no-attachments');
  }

  this.__updatePreview__();
};


// Get/set parse options
//
MDEdit.prototype.parseOptions = function (parseOptions) {
  if (!parseOptions) {
    return this.__options__.parseOptions;
  }

  this.__options__.parseOptions = parseOptions;

  this.__initToolbar__();
  this.__updatePreview__();
};


// Set initial Ace options
//
MDEdit.prototype.__initAce__ = function () {
  this.__ace__ = ace.edit(this.__layout__.find('.mdedit__edit-area').get(0));

  this.__ace__.renderer.scrollMargin.top = TEXT_MARGIN;
  this.__ace__.renderer.scrollMargin.bottom = TEXT_MARGIN;

  var aceSession = this.__ace__.getSession();

  aceSession.setMode('ace/mode/markdown');

  this.__ace__.setOptions({
    showLineNumbers: false,
    showGutter: false,
    highlightActiveLine: false
  });

  aceSession.setUseWrapMode(true);

  aceSession.on('change', this.__updatePreview__.bind(this));

  this.__ace__.focus();
};


// Add editor resize handler
//
MDEdit.prototype.__initResize__ = function () {
  var self = this;
  var $body = $('body');

  self.__minHeight__ = parseInt(this.__layout__.css('minHeight'), 10);
  self.__layout__.height(self.__minHeight__);

  this.__layout__.find('.mdedit__resizer').on('mousedown touchstart', function (event) {
    var clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    var currentHeight = parseInt(self.__layout__.height(), 10);

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
        var newHeight = currentHeight - (point.pageY - clickStart.pageY);

        self.__layout__.height(newHeight > self.__minHeight__ ? newHeight : self.__minHeight__);
        self.__ace__.resize();
      }, 20, { maxWait: 20 }));

    return false;
  });
};


// Update attachments, preview and save draft
//
MDEdit.prototype.__updatePreview__ = _.debounce(function () {
  var self = this;

  self.__layout__.trigger('change');

  N.parse(
    {
      text: this.text(),
      attachments: this.attachments(),
      options: this.__options__.parseOptions
    },
    function (err, result) {
      if (err) {
        // TODO: notify about err
        throw err;
      }

      self.__layout__.find('.mdedit__preview').html(N.runtime.render('mdedit.preview', {
        user_hid: N.runtime.user_hid,
        html: result.html,
        attachments: result.tail
      }));

      self.__layout__.find('.mdedit-attachments').html(N.runtime.render('mdedit.attachments', {
        attachments: self.attachments()
      }));
    }
  );
}, 500, { maxWait: 500, leading: true });


// Update toolbar button list
//
MDEdit.prototype.__initToolbar__ = function () {
  var self = this;
  var $toolbar = this.__layout__.find('.mdedit__toolbar');

  // Get actual buttons
  var buttons = _.reduce(this.__options__.toolbar, function (result, btn) {

    // If parser plugin inactive - remove button
    if (self.__options__.parseOptions[btn.depend] === false) {
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
  $toolbar.html(N.runtime.render('mdedit.toolbar', {
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


// Toolbar button click
//
N.wire.on('mdedit.toolbar:click', function toolbar_click(data) {
  var command = N.MDEdit.commands[data.$this.data('command')].bind(N.MDEdit);

  if (command) {
    command(N.MDEdit.__ace__);

    // Restore focus on editor after command execution
    N.MDEdit.__ace__.focus();
  }
});


// Attachment click
//
N.wire.on('mdedit.attachments:insert', function attachments_insert(data) {
  var url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: data.$this.data('media-id') });

  N.MDEdit.__ace__.insert('![](' + url + ')');
  N.MDEdit.__ace__.focus();

  data.event.stopPropagation();
});


// Remove attachment
//
N.wire.on('mdedit.attachments:remove', function attachments_insert(data) {
  var id = data.$this.data('media-id');
  var attachments = N.MDEdit.attachments();

  attachments = _.remove(attachments, function (val) { return val.media_id !== id; });
  N.MDEdit.attachments(attachments);
  data.event.stopPropagation();
});


// Done handler
//
N.wire.on('mdedit.submit', function done_click() {
  var event = new $.Event('submit');

  N.MDEdit.__layout__.trigger(event);

  if (!event.isDefaultPrevented()) {
    N.MDEdit.hide();
  }
});


// Hide on cancel
//
N.wire.on('mdedit.cancel', function close() {
  N.MDEdit.hide();
});


// Collapse/expand editor
//
N.wire.on('mdedit.collapse', function collapse() {
  var $layout = N.MDEdit.__layout__;

  // Expand
  if ($layout.hasClass('mdedit__m-collapsed')) {
    $layout.removeClass('mdedit__m-collapsed');
    $layout.height(N.MDEdit.__minHeight__);

  // Collapse
  } else {
    $layout.addClass('mdedit__m-collapsed');
    $layout.css('minHeight', 0);
    $layout.height($layout.find('.mdedit-header').height());
  }
});


// Dragdrop file to editor
//
N.wire.on('mdedit:dd', function mdedit_dd(data) {
  var $layout = N.MDEdit.__layout__;
  var x0, y0, x1, y1, ex, ey, uploaderData;

  switch (data.event.type) {
    case 'dragenter':
      $layout.addClass('mdedit__m-active');
      break;
    case 'dragleave':
      // 'dragleave' occurs when user move cursor over child HTML element
      // track this situation and don't remove 'active' class
      // http://stackoverflow.com/questions/10867506/
      x0 = $layout.offset().left;
      y0 = $layout.offset().top;
      x1 = x0 + $layout.outerWidth();
      y1 = y0 + $layout.outerHeight();
      ex = data.event.originalEvent.pageX;
      ey = data.event.originalEvent.pageY;

      if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
        $layout.removeClass('mdedit__m-active');
      }
      break;
    case 'drop':
      $layout.removeClass('mdedit__m-active');

      if (data.event.dataTransfer && data.event.dataTransfer.files && data.event.dataTransfer.files.length) {

        uploaderData = {
          files: data.event.dataTransfer.files,
          url: N.router.linkTo('users.media.upload'),
          config: 'users.uploader_config',
          uploaded: null
        };

        N.wire.emit('users.uploader:add', uploaderData, function () {
          var attachments = N.MDEdit.attachments();

          uploaderData.uploaded.forEach(function (media) {
            attachments.unshift(_.pick(media, [ 'media_id', 'file_name', 'type' ]));
          });

          N.MDEdit.attachments(attachments);
        });
      }
      break;
    default:
  }
});


// Add editor instance to 'N' & emit event for plugins
//
N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = new MDEdit();

  N.wire.emit('init:mdedit', {}, callback);
});
