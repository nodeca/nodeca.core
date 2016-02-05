// Add editor instance to 'N' & emit event for plugins
//
'use strict';


const CodeMirror = require('codemirror');
const _          = require('lodash');
const bag        = require('bagjs');
const RpcCache   = require('./_lib/rpc_cache')(N);


// Require markdown highlighter (mode) for CodeMirror
require('codemirror/mode/markdown/markdown');


const TEXT_MARGIN = 5;
const TOOLBAR = '$$ JSON.stringify(N.config.mdedit) $$';
const EMOJIS = '$$ JSON.stringify(N.config.parser.emojis) $$';


// Compile toolbar config
//
let compileToolbarConfig = _.memoize(function (name) {
  let buttonName;

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
  }, []).sort((a, b) => a.priority - b.priority);
});


// Editor init
//
function MDEdit() {
  this.emojis = EMOJIS;
  this.commands = {};
  this.__attachments__ = [];
  this.__options__ = null;
  this.__layout__ = null;
  this.__minHeight__ = 0;
  this.__cm__ = null;
  this.__bag__ = bag({ prefix: 'nodeca_editor' });
  this.__cache__ = new RpcCache();

  this.__cache__.on('update', () => N.wire.emit('mdedit:update.text'));
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
  let $oldLayout = this.__layout__;

  this.__layout__ = $(N.runtime.render('mdedit'));
  this.__options__ = _.clone(options);
  this.__options__.toolbar = compileToolbarConfig(this.__options__.toolbar || 'default');
  this.__options__.parseOptions = this.__options__.parseOptions || {};

  $('body').append(this.__layout__);

  // Clamp editor height
  $(window).off('resize.nd.mdedit').on('resize.nd.mdedit', _.debounce(() => {
    let winHeight = $(window).height();

    if (this.__layout__.height() > winHeight && winHeight >= this.__minHeight__) {
      this.__layout__.height(winHeight);
      this.__cm__.setSize('100%', this.__layout__.find('.mdedit__edit-area').height());
    }
  }, 50, { maxWait: 50 }));

  // Init CodeMirror instance
  this.__cm__ = new CodeMirror(this.__layout__.find('.mdedit__edit-area').get(0), {
    cursorScrollMargin: TEXT_MARGIN,
    lineWrapping: true,
    lineNumbers: false,
    tabindex: 2,
    mode: 'markdown'
  });

  // Set initial CodeMirror options
  this.__cm__.setOption('extraKeys', {
    Esc:          () => N.wire.emit('mdedit.cancel'),
    'Ctrl-Enter': () => N.wire.emit('mdedit.submit')
  });

  this.__cm__.on('change', () => N.wire.emit('mdedit:update.text'));

  N.wire.emit('mdedit:init');

  this.text(options.text || '');
  this.attachments(options.attachments || []);

  // Get editor height from localstore
  this.__bag__.get('height', (__, height) => {

    if (height) {
      // If no prevoius editor - set `bottom` for animation
      if (!$oldLayout) {
        this.__layout__.css({ bottom: -height });
      }

      // Restore prevoius editor height
      this.__layout__.height(height);
    }

    this.__layout__.trigger('show');

    // If no prevoius editor - animate editor from bottom viewport botder
    this.__layout__.animate({ bottom: 0 }, $oldLayout ? 0 : 'fast', () => {
      // Update codemirror height
      this.__cm__.setSize('100%', this.__layout__.find('.mdedit__edit-area').height());

      let $focusItem = this.__layout__.find('[tabindex=1]');

      if ($focusItem.length !== 0) {
        // Focus to element with tabindex = 1 if exists
        $focusItem.focus();
      } else {
        // Or focus to editor window
        this.__cm__.focus();
      }

      // Hide previous editor
      if ($oldLayout) {
        $oldLayout.trigger('hide');
        $oldLayout.trigger('hidden');
        $oldLayout.remove();
      }

      this.__layout__.trigger('shown');
    });
  });

  return this.__layout__;
};


// Hide editor
//
MDEdit.prototype.hide = function () {
  let $layout = this.__layout__;

  if (!$layout) return;

  $(window).off('resize.nd.mdedit');

  setTimeout(() => {
    $layout.trigger('hide');
    $layout.animate({ bottom: -$layout.height() }, 'fast', () => {
      this.__layout__ = null;
      $layout.trigger('hidden');
      $layout.remove();
    });
  }, 0);
};


// Get/set text
//
MDEdit.prototype.text = function (text) {
  if (!text) return this.__cm__.getValue();

  this.__cm__.setValue(text);
  this.__cm__.setCursor(this.__cm__.lineCount(), 0);

  N.wire.emit('mdedit:update.text');
};


// Get/set attachments
//
MDEdit.prototype.attachments = function (attachments) {
  if (!attachments) return this.__attachments__;

  this.__attachments__ = attachments;

  if (this.__attachments__.length === 0) {
    this.__layout__.addClass('mdedit__m-no-attachments');
  } else {
    this.__layout__.removeClass('mdedit__m-no-attachments');
  }

  N.wire.emit('mdedit:update.attachments');
};


// Get/set parse options
//
MDEdit.prototype.parseOptions = function (parseOptions) {
  if (!parseOptions) return this.__options__.parseOptions;

  this.__options__.parseOptions = parseOptions;

  N.wire.emit('mdedit:update.options');
};


// Add editor resize handler
//
N.wire.on('mdedit:init', function initResize() {
  let $body = $('body');
  let $window = $(window);
  let winHeight = $window.height();

  // load min-height limit & reset it to enable animation
  N.MDEdit.__minHeight__ = parseInt(N.MDEdit.__layout__.css('minHeight'), 10);
  N.MDEdit.__layout__.css('minHeight', 0);

  N.MDEdit.__layout__.height(N.MDEdit.__layout__.height());

  if (N.MDEdit.__layout__.height() > winHeight && winHeight >= N.MDEdit.__minHeight__) {
    N.MDEdit.__layout__.height(winHeight);
    N.MDEdit.__cm__.setSize('100%', N.MDEdit.__layout__.find('.mdedit__edit-area').height());
  }

  N.MDEdit.__layout__.find('.mdedit__resizer').on('mousedown touchstart', function (event) {
    let clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    let currentHeight = parseInt(N.MDEdit.__layout__.height(), 10);

    N.MDEdit.__layout__.addClass('mdedit__m-resizing');

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
        N.MDEdit.__layout__.removeClass('mdedit__m-resizing');
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        let point = event.originalEvent.touches ? event.originalEvent.touches[0] : event,
            newHeight = currentHeight - (point.pageY - clickStart.pageY),
            winHeight = $window.height();

        newHeight = newHeight > winHeight ? winHeight : newHeight;
        newHeight = newHeight < N.MDEdit.__minHeight__ ? N.MDEdit.__minHeight__ : newHeight;

        N.MDEdit.__bag__.set('height', newHeight);
        N.MDEdit.__layout__.height(newHeight);
        N.MDEdit.__cm__.setSize('100%', N.MDEdit.__layout__.find('.mdedit__edit-area').height());
      }, 20, { maxWait: 20 }));

    return false;
  });
});


// Done handler
//
N.wire.on('mdedit.submit', function done_click() {
  let event = new $.Event('submit');

  N.MDEdit.__layout__.trigger(event);

  if (!event.isDefaultPrevented()) {
    N.MDEdit.hide();
  }
});


// Hide when escape key is pressed
//
N.wire.on('event.keypress.escape', () => N.MDEdit.hide());


// Hide on cancel
//
N.wire.on('mdedit.cancel', () => N.MDEdit.hide());


// Collapse/expand editor
//
N.wire.on('mdedit.collapse', function collapse() {
  let $layout = N.MDEdit.__layout__;

  // Expand
  if ($layout.hasClass('mdedit__m-collapsed')) {
    $layout.removeClass('mdedit__m-collapsed');

  // Collapse
  } else {
    $layout.addClass('mdedit__m-collapsed');
  }
});


// Add editor instance to 'N' & emit event for plugins
//
N.wire.once('init:assets', function (__, callback) {
  N.MDEdit = new MDEdit();

  N.wire.emit('init:mdedit', {}, callback);
});
