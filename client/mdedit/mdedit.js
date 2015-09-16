// Add editor instance to 'N' & emit event for plugins
//
'use strict';


var CodeMirror = require('codemirror');
var _          = require('lodash');
var Bag        = require('bag.js');
var RpcCache   = require('./_lib/rpc_cache')(N);


// Require markdown highlighter (mode) for CodeMirror
require('codemirror/mode/markdown/markdown');


var TEXT_MARGIN = 5;
var TOOLBAR = '$$ JSON.stringify(N.config.mdedit) $$';
var EMOJIS = '$$ JSON.stringify(N.config.parser.emojis) $$';


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
  this.emojis = EMOJIS;
  this.commands = {};
  this.__attachments__ = [];
  this.__options__ = null;
  this.__layout__ = null;
  this.__hotkeys__ = {};
  this.__minHeight__ = 0;
  this.__cm__ = null;
  this.__bag__ = new Bag({ prefix: 'nodeca_editor' });
  this.__cache__ = new RpcCache();

  this.__cache__.on('update', function () {
    N.wire.emit('mdedit:update');
  });
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

  $('body').append(self.__layout__);
  $(window).off('resize.nd.mdedit').on('resize.nd.mdedit', self.__clampHeight__.bind(self));

  // Init CodeMirror instance
  self.__cm__ = new CodeMirror(self.__layout__.find('.mdedit__edit-area').get(0), {
    cursorScrollMargin: TEXT_MARGIN,
    lineWrapping: true,
    lineNumbers: false,
    tabindex: 2,
    mode: 'markdown'
  });

  // Set initial CodeMirror options
  self.__cm__.setOption('extraKeys', {
    Esc:          function () { N.wire.emit('mdedit.cancel'); },
    'Ctrl-Enter': function () { N.wire.emit('mdedit.submit'); }
  });

  self.__cm__.on('change', function () {
    N.wire.emit('mdedit:update');
  });

  self.__initResize__();
  self.__initToolbar__();
  N.wire.emit('mdedit:init');

  self.text(options.text || '');
  self.attachments(options.attachments || []);

  // Get editor height from localstore
  this.__bag__.get('height', function (__, height) {

    if (height) {
      // If no prevoius editor - set `bottom` for animation
      if (!$oldLayout) {
        self.__layout__.css({ bottom: -height });
      }

      // Restore prevoius editor height
      self.__layout__.height(height);
    }

    self.__layout__.trigger('show');

    // If no prevoius editor - animate editor from bottom viewport botder
    self.__layout__.animate({ bottom: 0 }, $oldLayout ? 0 : 'fast', function () {
      // Update codemirror height
      self.__cm__.setSize('100%', self.__layout__.find('.mdedit__edit-area').height());

      var $focusItem = self.__layout__.find('[tabindex=1]');

      if ($focusItem.length !== 0) {
        // Focus to element with tabindex = 1 if exists
        $focusItem.focus();
      } else {
        // Or focus to editor window
        self.__cm__.focus();
      }

      // Hide previous editor
      if ($oldLayout) {
        $oldLayout.trigger('hide');
        $oldLayout.trigger('hidden');
        $oldLayout.remove();
      }

      self.__layout__.trigger('shown');
    });
  });

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

  $(window).off('resize.nd.mdedit');

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
    return this.__cm__.getValue();
  }

  this.__cm__.setValue(text);
  this.__cm__.setCursor(this.__cm__.lineCount(), 0);

  N.wire.emit('mdedit:update');
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

  N.wire.emit('mdedit:update');
};


// Get/set parse options
//
MDEdit.prototype.parseOptions = function (parseOptions) {
  if (!parseOptions) {
    return this.__options__.parseOptions;
  }

  this.__options__.parseOptions = parseOptions;

  this.__initToolbar__();
  N.wire.emit('mdedit:update');
};


// Add editor resize handler
//
MDEdit.prototype.__initResize__ = function () {
  var self = this,
      $body = $('body'),
      $window = $(window);

  // load min-height limit & reset it to enable animation
  self.__minHeight__ = parseInt(this.__layout__.css('minHeight'), 10);
  self.__layout__.css('minHeight', 0);

  self.__layout__.height(self.__layout__.height());

  self.__clampHeight__();

  this.__layout__.find('.mdedit__resizer').on('mousedown touchstart', function (event) {
    var clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    var currentHeight = parseInt(self.__layout__.height(), 10);

    self.__layout__.addClass('mdedit__m-resizing');

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
        self.__layout__.removeClass('mdedit__m-resizing');
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event,
            newHeight = currentHeight - (point.pageY - clickStart.pageY),
            winHeight = $window.height();

        newHeight = newHeight > winHeight ? winHeight : newHeight;
        newHeight = newHeight < self.__minHeight__ ? self.__minHeight__ : newHeight;

        self.__bag__.set('height', newHeight);
        self.__layout__.height(newHeight);
        self.__cm__.setSize('100%', self.__layout__.find('.mdedit__edit-area').height());
      }, 20, { maxWait: 20 }));

    return false;
  });
};


// Reduce size on small viewports
//
MDEdit.prototype.__clampHeight__ = _.debounce(function () {
  var winHeight = $(window).height();

  if (this.__layout__.height() > winHeight &&
      winHeight >= this.__minHeight__) {
    this.__layout__.height(winHeight);
    this.__cm__.setSize('100%', this.__layout__.find('.mdedit__edit-area').height());
  }
}, 50, { maxWait: 50 });


// Update toolbar button list
//
MDEdit.prototype.__initToolbar__ = function () {
  var self = this;
  var $toolbar = this.__layout__.find('.mdedit__toolbar');

  if (this.__toolbarHotkeys__) {
    this.__cm__.removeKeyMap(this.__toolbarHotkeys__);
  }

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

  // Process hotkeys for editor
  this.__toolbarHotkeys__ = buttons.reduce(function (result, button) {
    if (!button.command || !button.bind_key || !self.commands[button.command]) {
      return result;
    }

    _.forEach(button.bind_key, function (bindKey) {
      result[bindKey] = function () {
        self.commands[button.command](self.__cm__);
      };
    });

    return result;
  }, {});

  // Enable active button's hotkeys
  this.__cm__.addKeyMap(this.__toolbarHotkeys__);
};


// Toolbar button click
//
N.wire.on('mdedit.toolbar:click', function toolbar_click(data) {
  var command = N.MDEdit.commands[data.$this.data('command')].bind(N.MDEdit);

  if (command) {
    command(N.MDEdit.__cm__);

    // Restore focus on editor after command execution
    N.MDEdit.__cm__.focus();
  }
});


// Attachment click
//
N.wire.on('mdedit.attachments:insert', function attachments_insert(data) {
  var url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: data.$this.data('media-id') });
  var cm = N.MDEdit.__cm__;

  cm.replaceRange('![](' + url + ')', cm.getCursor(), cm.getCursor());
  cm.focus();

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


// Hide when escape key is pressed
//
N.wire.on('event.keypress.escape', function mdedit_close() {
  N.MDEdit.hide();
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

  // Collapse
  } else {
    $layout.addClass('mdedit__m-collapsed');
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
