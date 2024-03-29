// Add editor instance to 'N' & emit event for plugins
//
'use strict';


const _                 = require('lodash');
const bkv               = require('bkv').shared();
const RpcCache          = require('./_lib/rpc_cache')(N);
const md_writer         = require('nodeca.core/lib/parser/md_writer');
const text_field_update = require('./_lib/text_field_update');


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
  this.__bkv__          = bkv;
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
  this.__textarea__ = this.__layout__.find('.mdedit__edit-area')[0];
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
    }
  }, 50, { maxWait: 50 }));

  this.__textarea__.addEventListener('input', () => N.wire.emit('mdedit:update.text'));
  this.__textarea__.addEventListener('change', () => N.wire.emit('mdedit:update.text'));

  this.__textarea__.addEventListener('keydown', () => {
    let textarea = this.__textarea__;

    if (textarea.selectionStart === textarea.value.length) {
      // if we are on the last line, scroll editor all the way down
      // (without this editor will have few px of padding left to scroll)
      //
      // need to check difference because scrollTop can be fractional
      if (Math.abs(textarea.scrollHeight - textarea.clientHeight - textarea.scrollTop) >= 1) {
        textarea.scrollTop = textarea.scrollHeight - textarea.clientHeight;
      }
    }
  });

  N.wire.emit('mdedit:init');

  this.text(options.text || '');

  // Get settings from localstore
  Promise.all([ 'narrow_mode', 'height' ].map(arg => this.__bkv__.get(arg)))
    .then(([ narrow_mode, height ]) => {
      if (narrow_mode) {
        N.MDEdit.__layout__.addClass('mdedit__m-narrow');
      }

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
        let $focusItem = this.__layout__.find('[tabindex=1]');

        if ($focusItem.length !== 0) {
          // Focus to element with tabindex = 1 if exists
          $focusItem.focus();
        } else {
          // Or focus to editor window
          this.__textarea__.focus();
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


  // Load draft if needed
  //
  this.__layout__.on('show.nd.mdedit', () => {
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

        // Need to save draft if:
        //  - textarea value is changed (`input`, `change`)
        //  - user scrolls the editor (`scroll`)
        //  - cursor position changes (`keydown`, `click`)
        this.__textarea__.addEventListener('input', markStateChanged);
        this.__textarea__.addEventListener('change', markStateChanged);
        this.__textarea__.addEventListener('scroll', markStateChanged);
        this.__textarea__.addEventListener('keydown', markStateChanged);
        this.__textarea__.addEventListener('click', markStateChanged);

        this.__state_monitor__ = setInterval(() => {
          if (this.__state_changed__) this.__state_save__();
        }, 2000);
      });
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
    this.__bkv__.remove(`mdedit_${this.__options__.draftKey}`);
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

    let draft = {
      text:            this.text(),
      selectionStart:  this.__textarea__.selectionStart,
      selectionEnd:    this.__textarea__.selectionEnd,
      scrollTop:       this.__textarea__.scrollTop
    };

    // Collect custom fields
    Object.keys(this.__options__.draftCustomFields).forEach(fieldName => {
      let fieldType = this.__options__.draftCustomFields[fieldName];

      if (fieldType === 'input') draft[fieldName] = $(fieldName).val();
      else draft[fieldName] = fieldType();
    });

    return this.__bkv__.set(`mdedit_${this.__options__.draftKey}`, draft, DRAFTS_EXPIRE);
  });
};


// Load previously stored editor state
//
MDEdit.prototype.__state_load__ = function () {
  return Promise.resolve().then(() => {
    if (!this.__options__.draftKey) return;
    if (!this.__layout__) return;

    this.__state_changed__ = false;

    return this.__bkv__.get(`mdedit_${this.__options__.draftKey}`)
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
        if (draft.selectionStart) this.__textarea__.selectionStart = draft.selectionStart;
        if (draft.selectionEnd) this.__textarea__.selectionEnd = draft.selectionEnd;
        if (draft.scrollTop) this.__textarea__.scrollTop = draft.scrollTop;

        return draft;
      });
  });
};


// Get/set text
//
MDEdit.prototype.text = function (text) {
  if (typeof text === 'undefined') {
    let result = this.__textarea__.value;
    return result;
  }

  this.__textarea__.value = text;
  this.__textarea__.setSelectionRange(0, 0);

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
  let editor = N.MDEdit.__textarea__;
  let writer = new md_writer.NodecaMarkdownWriter();
  let insertion = writer.format_quote(writer.convert(element), href).replace(/^\n*/g, '\n');

  text_field_update.insert(editor, insertion);
};


// Returns `true` if editor is created (opened or collapsed)
//
MDEdit.prototype.exists = function () {
  return !!this.__layout__;
};


// Collapse/expand editor;
// if an editor without text is to be collapsed, it's hidden instead
//
MDEdit.prototype.toggle_collapse = function (value) {
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


// Expand editor to full screen or back
//
MDEdit.prototype.toggle_full = function () {
  this.__layout__.toggleClass('mdedit__m-fullscreen');
};


// Make editor narrow
//
MDEdit.prototype.toggle_narrow = function () {
  this.__layout__.toggleClass('mdedit__m-narrow');
  this.__bkv__.set('narrow_mode', this.__layout__.hasClass('mdedit__m-narrow'));
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

        N.MDEdit.__bkv__.set('height', newHeight);
        N.MDEdit.__layout__.outerHeight(newHeight);
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

  N.MDEdit.__layout__.find('.mdedit-btn__preview')
    .toggleClass('btn-link', !previewMode)
    .toggleClass('btn-outline-success', previewMode);
});


// Collapse/expand editor
//
N.wire.on('mdedit.toggle_collapse', function toggle_collapse() {
  N.MDEdit.toggle_collapse();
});


// Expand editor to full screen
//
N.wire.on('mdedit.toggle_full', function toggle_fullscreen() {
  N.MDEdit.toggle_full();
});


// Expand editor to full screen
//
N.wire.on('mdedit.toggle_narrow', function toggle_narrow() {
  N.MDEdit.toggle_narrow();
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

        return Promise.resolve()
          .then(() => N.loader.loadAssets('users'))
          .then(() => N.wire.emit('users.uploader:add', uploaderData, function () {
            let tpl = _.template('![<%= alt %>](<%= url %>)');
            let editor = N.MDEdit.__textarea__;

            let str = uploaderData.uploaded.map(media => {
              let url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: media.media_id });

              return tpl({ alt: '', url });
            }).join(' ');

            text_field_update.insert(editor, str);
          }));
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
