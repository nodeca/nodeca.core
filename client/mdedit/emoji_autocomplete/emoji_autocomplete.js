'use strict';


const textarea_to_div = require('../_lib/textarea_to_div');


N.wire.once('init:mdedit', function () {

  function positionToRect(start, end) {
    let div = textarea_to_div(N.MDEdit.__textarea__);
    div.textContent = N.MDEdit.__textarea__.value;

    let range = document.createRange();
    range.setStart(div.childNodes[0], start);
    range.setEnd(div.childNodes[0], end);

    let divRect = div.getBoundingClientRect();
    let textRect = range.getBoundingClientRect();

    div.remove();

    return new DOMRect(textRect.x - divRect.x, textRect.y - divRect.y, textRect.width, textRect.height);
  }

  // Init emojis select popup.
  //
  // Behaviour:
  //
  // - show when
  //   - ':' typed at start of line or after space
  //   - backspace typed and string before cursor finished to emoji start
  // - hide when
  //   - escape pressed
  //   - editor lost focus
  //   - cursor position changed
  // - apply when
  //   - enter or right arrow pressed
  //   - click by emoji
  //
  N.wire.on('mdedit:init', function initEmojis() {
    let $popup = N.MDEdit.__layout__.find('.emoji-autocomplete');

    // To check emoji start at line end (and extract emoji text)
    let emojiAtEndRE = /(?:^|\s):([^:\s]*)$/;


    // Show or update popup
    //
    function showPopup(text) {
      let emojis = {};

      // Filter emijis by text (but not more than 5)
      for (let [ name, val ] of Object.entries(N.MDEdit.emojis.named)) {
        if (name.startsWith(text)) {
          emojis[name] = val;
        } else {
          continue;
        }

        if (Object.keys(emojis).length >= 5) break;
      }

      // If nothing found - hide popup
      if (Object.keys(emojis).length === 0) {
        $popup.removeClass('emoji-autocomplete__m-visible');
        return;
      }

      // Render emojis list
      $popup.html(N.runtime.render('mdedit.emoji_autocomplete', { emojis, search: text }));

      // Should be called after cursor position change (after event propagation finish)
      setTimeout(function () {
        // Show popup
        $popup.addClass('emoji-autocomplete__m-visible');

        let layoutOffset = N.MDEdit.__layout__.offset();
        let $textarea = N.MDEdit.__layout__.find('.mdedit__edit-area');
        let textareaOffset = $textarea.offset();
        let cursorOffset = positionToRect(N.MDEdit.__textarea__.selectionEnd, N.MDEdit.__textarea__.selectionEnd);
        let layoutPadding = parseInt(N.MDEdit.__layout__.css('padding-right'), 10);
        let top = cursorOffset.y - $textarea.scrollTop() + textareaOffset.top - layoutOffset.top - $popup.height();
        let left = cursorOffset.x - $textarea.scrollLeft() + textareaOffset.left - layoutOffset.left;

        // If popup outside right editor edge - attach it to right edge
        if (left + $popup.outerWidth() > layoutOffset.left + N.MDEdit.__layout__.outerWidth() - layoutPadding) {
          left = (layoutOffset.left + N.MDEdit.__layout__.outerWidth() - layoutPadding) - $popup.outerWidth();
        }

        // If popup outside top editor edge - move it under cursor
        if (top < 0) {
          top = cursorOffset.y - $textarea.scrollTop() + textareaOffset.top - layoutOffset.top + cursorOffset.height;
        }

        // Set popup position above cursor
        $popup.css({ top, left });
      }, 0);
    }


    // Insert emoji to editor area and hide popup
    //
    function insert(emoji) {
      let editor = N.MDEdit.__textarea__;

      // Find nearest ':' symbol before cursor on the current line
      let selectionStart = Math.max(
        editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1,
        editor.value.lastIndexOf(':', editor.selectionStart)
      );
      let selectionEnd = editor.selectionEnd;

      $popup.removeClass('emoji-autocomplete__m-visible');

      editor.setRangeText(':' + emoji + ':', selectionStart, selectionEnd, 'end');
      editor.dispatchEvent(new Event('change'));
      editor.focus();
    }


    function on_text_change() {
      // Stop here if emoji disabled
      if (!N.MDEdit.__options__.parseOptions.emoji) return;

      let editor = N.MDEdit.__textarea__;
      let popupShown = $popup.hasClass('emoji-autocomplete__m-visible');

      // Get line before cursor
      let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
      let line = editor.value.slice(lineStart, editor.selectionEnd);

      if (!emojiAtEndRE.test(line)) {
        if (popupShown) {
          $popup.removeClass('emoji-autocomplete__m-visible');
        }
        return;
      }

      let emojiText = line.match(emojiAtEndRE)[1];

      if (popupShown) {
        // Update popup if already shown
        showPopup(emojiText);
      } if (emojiText === '') {
        // Show popup if ':' typed
        showPopup(emojiText);
      }
    }


    // Show or hide popup if text changed
    //
    N.MDEdit.__textarea__.addEventListener('input', on_text_change);


    // Hide or update popup if cursor position changed (can be done with mouse, touch or left arrow)
    //
    function on_cursor_activity() {
      if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

      let editor = N.MDEdit.__textarea__;

      if (editor.selectionStart !== editor.selectionEnd) {
        // something is selected
        $popup.removeClass('emoji-autocomplete__m-visible');
        return;
      }

      // Get line before cursor
      let lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
      let line = editor.value.slice(lineStart, editor.selectionEnd);

      if (!emojiAtEndRE.test(line)) {
        $popup.removeClass('emoji-autocomplete__m-visible');
        return;
      }

      showPopup(line.match(emojiAtEndRE)[1]);
    }


    N.MDEdit.__textarea__.addEventListener('click', on_cursor_activity);


    // Insert emoji to text if clicked. We should use `mousedown` instead of `click`
    // because `click` could be canceled (if mouseup event cause when popup invisible)
    //
    $popup.on('mousedown touchstart', '.emoji-autocomplete-item__link', function () {
      insert($(this).data('value'));

      return false;
    });


    // Handle keypress if popup shown
    //
    N.MDEdit.__textarea__.addEventListener('keydown', function (event) {
      if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

      // `keyCode` for IE, `which` for others
      let code = event.which || event.keyCode;
      let $item;
      let $selected;

      switch (code) {
        // Up - select previous popup list item
        case 38:
          $selected = $popup.find('.emoji-autocomplete-item__m-selected');
          $item = $popup.find('.emoji-autocomplete-item:nth-child(' + ((1 + $selected.index()) - 1) + ')');

          if ($item.length) {
            $selected.removeClass('emoji-autocomplete-item__m-selected');
            $item.addClass('emoji-autocomplete-item__m-selected');
          }
          break;

        // Down - select next popup list item
        case 40:
          $selected = $popup.find('.emoji-autocomplete-item__m-selected');
          $item = $popup.find('.emoji-autocomplete-item:nth-child(' + ((1 + $selected.index() + 1)) + ')');

          if ($item.length) {
            $selected.removeClass('emoji-autocomplete-item__m-selected');
            $item.addClass('emoji-autocomplete-item__m-selected');
          }
          break;

        // Enter or right - insert current emoji
        case 13:
        case 39:
          $selected = $popup.find('.emoji-autocomplete-item__m-selected .emoji-autocomplete-item__link');
          insert($selected.data('value'));

          break;

        // Esc - hide popup
        case 27:
          $popup.removeClass('emoji-autocomplete__m-visible');
          break;

        default:
          return;
      }

      event.preventDefault();

      // prevent ESC from closing editor
      event.stopPropagation();
    });


    // Hide popup if focus lost
    //
    N.MDEdit.__textarea__.addEventListener('blur', function () {
      // Wait 50 ms before hide popup to allow click by popup item
      setTimeout(function () {
        if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

        $popup.removeClass('emoji-autocomplete__m-visible');
      }, 50);
    });
  });
});
