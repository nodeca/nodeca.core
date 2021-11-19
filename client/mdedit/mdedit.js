// Add editor instance to 'N' & emit event for plugins
//
'use strict';


const CodeMirror = require('codemirror');
const _          = require('lodash');
const bag        = require('bagjs');
const RpcCache   = require('./_lib/rpc_cache')(N);
const md_writer  = require('nodeca.core/lib/parser/md_writer');


// Require markdown highlighter (mode) for CodeMirror
require('codemirror/mode/markdown/markdown');


const TEXT_MARGIN = 5;
const TOOLBAR = '$$ JSON.stringify(N.config.mdedit) $$';
const EMOJIS = '$$ JSON.stringify(N.config.parser.emojis) $$';
const DRAFTS_EXPIRE = 7 * 24 * 60 * 60; // 7 days


// Compile toolbar config
//
let compileToolbarConfig = _.memoize(function (name) {
  let buttonName;
  let result = [];

  for (let [ key, buttonParams ] of Object.entries(TOOLBAR[name])) {
    if (!buttonParams) continue;

    buttonName = key.indexOf('separator') === 0 ? 'separator' : key;

    if (buttonParams === true) {
      result.push(TOOLBAR.buttons[buttonName]);
    } else {
      result.push(Object.assign({}, TOOLBAR.buttons[buttonName], buttonParams));
    }
  }

  return result.sort((a, b) => a.priority - b.priority);
});


// Allow to scroll page to the end when editor is opened (add extra padding)
//
function adjustContentMargin(options) {
  let $footer = $('.page-footer');

  if (options?.clear) {
    $footer.css('padding-bottom', 0);
    return;
  }

  $footer.css('padding-bottom', N.MDEdit.__layout__.outerHeight());
}


// Editor init
//
function MDEdit() {
  this.emojis           = EMOJIS;
  this.commands         = {};
  this.__options__      = null;
  this.__layout__       = null;
  this.__minHeight__    = 0;
  this.__cm__           = null;
  this.__bag__          = bag({ prefix: 'nodeca' });
  this.__cache__        = new RpcCache();
  this.__state_changed__  = false;
  this.__state_monitor__  = null; // setInterval() result

  this.__cache__.on('update', () => N.wire.emit('mdedit:update.text'));
}


// Create new layout and show
//
// Options:
//
// - parseOptions (Object) - optional, object with plugins config like
//   `{ images: true, links: true, attachments: false }`, default `{}`
// - text (String) - optional, text, default empty string. Can be overwritten by draft
// - toolbar (String) - optional, name of toolbar config, default `default`
// - draftKey (String) - optional, unique key to store draft, don't use drafts by default
// - draftCustomFields (Object) - optional, custom fields to store in draft:
//   ```
//   {
//     // Could be a selector
//     '.topic-create__title': 'input',
//
//     // Or get/set function
//     to: value => {
//       if (!value) /* return value; */
//       /* set value */
//     }
//   }
//   ```
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
// - `ready.nd.mdedit` - after draft is loaded
//
MDEdit.prototype.show = function (options) {
  let $oldLayout = this.__layout__;

  this.__layout__ = $(N.runtime.render('mdedit'));
  this.__options__ = Object.assign({}, options);

  this.__options__.toolbar = compileToolbarConfig(this.__options__.toolbar || 'default');
  this.__options__.parseOptions = this.__options__.parseOptions || {};
  this.__options__.draftCustomFields = this.__options__.draftCustomFields || {};

  if (this.__options__.hidePreview) {
    N.MDEdit.__layout__.toggleClass('mdedit__m-show-preview');
    N.MDEdit.__layout__.find('.mdedit-btn__preview')
      .toggleClass('btn-link btn-outline-success');
  }

  $('body').append(this.__layout__);

  // Clamp editor height
  $(window).off('resize.nd.mdedit').on('resize.nd.mdedit', _.debounce(() => {
    let winHeight = $(window).height();

    if (this.__layout__.outerHeight() > winHeight && winHeight >= this.__minHeight__) {
      this.__layout__.outerHeight(winHeight);
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

  // Get preview flag from localstore
  this.__bag__.get('hide_preview').catch(() => false).then(hide_preview => {
    if (!hide_preview) {
      N.MDEdit.__layout__.addClass('mdedit__m-show-preview');
    }

    // Get editor height from localstore
    this.__bag__.get('height').catch(() => 0).then(height => {

      if (height) {
        // If no prevoius editor - set `bottom` for animation
        if (!$oldLayout) {
          this.__layout__.css({ bottom: -height });
        }

        // Restore prevoius editor height
        this.__layout__.outerHeight(height);
      }

      this.__layout__.trigger('show');

      adjustContentMargin();

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
  });


  // Load draft if needed
  //
  this.text(options.text || '');

  const markStateChanged = () => { this.__state_changed__ = true; };

  this.__state_load__()
    .then(() => {
      this.__layout__.trigger('ready');

      // Setup update handlers
      this.__layout__.on(
        'change.nd.mdedit input.nd.mdedit',
        '.mdedit-header input',
        markStateChanged
      );
      this.__cm__.on('cursorActivity', markStateChanged);
      this.__cm__.on('scroll', markStateChanged);

      this.__state_monitor__ = setInterval(() => {
        if (this.__state_changed__) this.__state_save__();
      }, 2000);
    });

  return this.__layout__;
};


// Hide editor
//
// - options (Object)
//   - removeDraft (Boolean) - optional, remove draft after hide, default `false`
//
MDEdit.prototype.hide = function (options) {
  let $layout = this.__layout__;

  if (!$layout) return;

  $(window).off('resize.nd.mdedit');

  clearInterval(this.__state_monitor__);

  // Remove draft if needed
  if (options?.removeDraft && this.__options__.draftKey) {
    this.__bag__.remove(`mdedit_${this.__options__.draftKey}`)
      .catch(() => {}); // Suppress storage errors
  }

  setTimeout(() => {
    $layout.trigger('hide');
    adjustContentMargin({ clear: true });
    $layout.animate({ bottom: -$layout.height() }, 'fast', () => {
      this.__layout__ = null;
      $layout.trigger('hidden');
      $layout.remove();
    });
  }, 0);
};


// Save editor state (as "draft")
// - fields
// - cursor & scroll prosition
//
MDEdit.prototype.__state_save__ = function () {
  return Promise.resolve().then(() => {
    if (!this.__state_changed__) return;

    this.__state_changed__ = false;

    if (!this.__options__.draftKey) return Promise.resolve();
    if (!this.__layout__) return;

    let cm         = this.__cm__;

    let draft = {
      text:         this.text(),
      cursor:       cm.getCursor(),
      scrollTop:    cm.getScrollInfo().top
    };

    // Collect custom fields
    Object.keys(this.__options__.draftCustomFields).forEach(fieldName => {
      let fieldType = this.__options__.draftCustomFields[fieldName];

      if (fieldType === 'input') draft[fieldName] = $(fieldName).val();
      else draft[fieldName] = fieldType();
    });

    return this.__bag__.set(`mdedit_${this.__options__.draftKey}`, draft, DRAFTS_EXPIRE)
      .catch(() => {}); // Suppress storage errors
  });
};


// Load previously stored editor state
//
MDEdit.prototype.__state_load__ = function () {
  return Promise.resolve().then(() => {
    if (!this.__options__.draftKey) return;
    if (!this.__layout__) return;

    this.__state_changed__ = false;

    return this.__bag__.get(`mdedit_${this.__options__.draftKey}`)
      .then(draft => {
        if (!draft) return;

        // Load custom fields
        Object.keys(this.__options__.draftCustomFields).forEach(fieldName => {
          if (!draft[fieldName]) return; // continue

          let fieldType = this.__options__.draftCustomFields[fieldName];

          if (fieldType === 'input') {
            $(fieldName).val(draft[fieldName]);
          } else {
            fieldType(draft[fieldName]);
          }
        });

        //
        // Load text, cursor & scroll
        //
        if (draft.text) this.text(draft.text);
        if (draft.cursor) this.__cm__.setCursor(draft.cursor);
        if (draft.scrollTop) this.__cm__.scrollTo(draft.scrollTop);

        return draft;
      })
      .catch(() => {}); // Suppress storage errors
  });
};


// Get/set text
//
MDEdit.prototype.text = function (text) {
  if (typeof text === 'undefined') {
    let result = this.__cm__.getValue();
    return result;
  }

  this.__cm__.setValue(text);
  this.__cm__.setCursor(this.__cm__.lineCount(), 0);

  N.wire.emit('mdedit:update.text');
};


// Get/set parse options
//
MDEdit.prototype.parseOptions = function (parseOptions) {
  if (!parseOptions) return this.__options__.parseOptions;

  this.__options__.parseOptions = parseOptions;

  N.wire.emit('mdedit:update.options');
};


// Insert quote into editor
//
MDEdit.prototype.insertQuote = function (element, href = null) {
  let editor = N.MDEdit.__cm__;
  let writer = new md_writer.NodecaMarkdownWriter();
  let insertion = writer.format_quote(writer.convert(element), href).replace(/^\n*/g, '\n');

  if (editor.somethingSelected()) {
    editor.replaceSelection(insertion);
  } else {
    editor.replaceRange(insertion, editor.getCursor(), editor.getCursor());
  }

  editor.focus();
};


// Returns `true` if editor is created (opened or collapsed)
//
MDEdit.prototype.exists = function () {
  return !!this.__layout__;
};


// Collapse/expand editor;
// if an editor without text is to be collapsed, it's hidden instead
//
MDEdit.prototype.toggle = function (value) {
  let doExpand;

  if (value === true) {
    doExpand = true;
  } else if (value === false) {
    doExpand = false;
  } else {
    doExpand = this.__layout__.hasClass('mdedit__m-collapsed');
  }

  // Check if user written something into text editor or any of the input-based custom fields
  let isEditorEmpty = true;
  if (this.text().trim()) isEditorEmpty = false;

  // Collapse editor if user wrote anything, close it otherwise.
  // This only checks editor itself, custom fields are not checked because we can't know if they exist
  // (nodeca doesn't set `draftCustomFields` property when editing).
  if (!doExpand && isEditorEmpty) {
    this.hide();
    return;
  }

  // Expand
  if (doExpand) {
    this.__layout__.removeClass('mdedit__m-collapsed');

  // Collapse
  } else {
    this.__layout__.addClass('mdedit__m-collapsed');
  }

  adjustContentMargin();
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

  N.MDEdit.__layout__.outerHeight(N.MDEdit.__layout__.outerHeight());

  if (N.MDEdit.__layout__.outerHeight() > winHeight && winHeight >= N.MDEdit.__minHeight__) {
    N.MDEdit.__layout__.outerHeight(winHeight);
    N.MDEdit.__cm__.setSize('100%', N.MDEdit.__layout__.find('.mdedit__edit-area').height());
  }

  N.MDEdit.__layout__.find('.mdedit__resizer').on('mousedown touchstart', function (event) {
    let clickStart = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
    let currentHeight = parseInt(N.MDEdit.__layout__.outerHeight(), 10);

    N.MDEdit.__layout__.addClass('mdedit__m-resizing');

    $body
      .on('mouseup.nd.mdedit touchend.nd.mdedit', function () {
        $body.off('.nd.mdedit');
        N.MDEdit.__layout__.removeClass('mdedit__m-resizing');
        adjustContentMargin();
      })
      .on('mousemove.nd.mdedit touchmove.nd.mdedit', _.debounce(function (event) {
        let point = event.originalEvent.touches ? event.originalEvent.touches[0] : event,
            newHeight = currentHeight - (point.pageY - clickStart.pageY),
            winHeight = $window.height();

        newHeight = newHeight > winHeight ? winHeight : newHeight;
        newHeight = newHeight < N.MDEdit.__minHeight__ ? N.MDEdit.__minHeight__ : newHeight;

        N.MDEdit.__bag__.set('height', newHeight);
        N.MDEdit.__layout__.outerHeight(newHeight);
        N.MDEdit.__cm__.setSize('100%', N.MDEdit.__layout__.find('.mdedit__edit-area').height());
      }, 20, { maxWait: 20 }));

    return false;
  });
});


// Done handler
//
N.wire.on('mdedit.submit', function done_click() {
  if (N.MDEdit.__layout__.find('.mdedit-btn__submit').hasClass('disabled')) {
    return;
  }

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


// Toggle preview on small screens
//
N.wire.on('mdedit.preview_sm', () => {
  N.MDEdit.__layout__.toggleClass('mdedit__m-preview_mode');

  let previewMode = N.MDEdit.__layout__.hasClass('mdedit__m-preview_mode');

  N.MDEdit.__layout__.find('.mdedit-btn__preview-sm')
    .toggleClass('btn-link', !previewMode)
    .toggleClass('btn-outline-success', previewMode);
});


// Toggle preview on large screens
//
N.wire.on('mdedit.preview', () => {
  N.MDEdit.__layout__.toggleClass('mdedit__m-show-preview');

  let showPreview = N.MDEdit.__layout__.hasClass('mdedit__m-show-preview');

  N.MDEdit.__bag__.set('hide_preview', !showPreview);
});


// Collapse/expand editor
//
N.wire.on('mdedit.toggle', function toggle() {
  N.MDEdit.toggle();
});


// Dragdrop file to editor
//
N.wire.on('mdedit:dd', function mdedit_dd(data) {
  // TODO: move this method to nodeca.users

  let $layout = N.MDEdit.__layout__;
  let x0, y0, x1, y1, ex, ey, uploaderData;

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

      if (data.files?.length) {

        uploaderData = {
          files: data.files,
          rpc: [ 'users.media.upload' ],
          config: 'users.uploader_config',
          uploaded: null
        };

        N.wire.emit('users.uploader:add', uploaderData, function () {
          let tpl = _.template('![<%= alt %>](<%= url %>)');
          let editor = N.MDEdit.__cm__;

          let str = uploaderData.uploaded.map(media => {
            let url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: media.media_id });

            return tpl({ alt: '', url });
          }).join(' ');

          if (editor.somethingSelected()) {
            editor.replaceSelection(str);
          } else {
            editor.replaceRange(str, editor.getCursor(), editor.getCursor());
          }

          editor.focus();
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
