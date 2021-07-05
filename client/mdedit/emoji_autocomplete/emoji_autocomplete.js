'use strict';


N.wire.once('init:mdedit', function () {

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
    var $popup = N.MDEdit.__layout__.find('.emoji-autocomplete');

    // To check emoji start at line end (and extract emoji text)
    var emojiAtEndRE = /(?:^|\s):([^:\s]*)$/;


    // Show or update popup
    //
    function showPopup(text) {
      var emojis = {};

      // Filter emijis by text (but not more than 5)
      for (let [ name, val ] of Object.entries(N.MDEdit.emojis.named)) {
        if (name.indexOf(text) !== -1) {
          emojis[name] = val;
        } else {
          return true; // continue
        }

        if (Object.keys(emojis).length >= 5) return false; // break;
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

        var $cursor = N.MDEdit.__layout__.find('.CodeMirror-cursor');
        var layoutOffset = N.MDEdit.__layout__.offset();
        var cursorOffset = $cursor.offset();
        var layoutPadding = parseInt(N.MDEdit.__layout__.css('padding-right'), 10);
        var top = cursorOffset.top - layoutOffset.top - $popup.height();
        var left = cursorOffset.left - layoutOffset.left;

        // If popup outside right editor edge - attach it to right edge
        if (left + $popup.outerWidth() > layoutOffset.left + N.MDEdit.__layout__.outerWidth() - layoutPadding) {
          left = (layoutOffset.left + N.MDEdit.__layout__.outerWidth() - layoutPadding) - $popup.outerWidth();
        }

        // If popup outside top editor edge - move it under cursor
        if (top < 0) {
          top = cursorOffset.top - layoutOffset.top + $cursor.outerHeight();
        }

        // Set popup position above cursor
        $popup.css({ top, left });
      }, 0);
    }


    // Insert emoji to editor area and hide popup
    //
    function insert(emoji) {
      var curEnd = N.MDEdit.__cm__.getCursor();
      var line = N.MDEdit.__cm__.getDoc().getLine(curEnd.line);

      // Find nearest ':' symbol before cursor
      var curBegin = { ch: line.lastIndexOf(':', curEnd.ch), line: curEnd.line };

      if (curBegin.ch === -1) {
        curBegin.ch = 0;
      }

      N.MDEdit.__cm__.replaceRange(':' + emoji + ':', curBegin, curEnd);
      $popup.removeClass('emoji-autocomplete__m-visible');
      N.MDEdit.__cm__.focus();
    }


    // Show or hide popup if text changed
    //
    N.MDEdit.__cm__.on('change', function (editor, changeObj) {
      // Stop here if emoji disabled
      if (!N.MDEdit.__options__.parseOptions.emoji) return;

      var poputShown = $popup.hasClass('emoji-autocomplete__m-visible');
      var cursor = editor.getCursor();
      // Get line before cursor
      var line = editor.getDoc().getLine(cursor.line).substr(0, cursor.ch);

      if (!emojiAtEndRE.test(line)) {
        if (poputShown) {
          $popup.removeClass('emoji-autocomplete__m-visible');
        }
        return;
      }

      var emojiText = line.match(emojiAtEndRE)[1];

      if (changeObj.origin === '+input') {
        if (poputShown) {
          // Update popup if already shown
          showPopup(emojiText);
        } if (emojiText === '') {
          // Show popup if ':' typed
          showPopup(emojiText);
        }
        return;
      }

      if (changeObj.origin === '+delete') {
        // Show popup if backspace pressed and line match pattern
        showPopup(emojiText);
      }
    });


    // Hide or update popup if cursor position changed (can be done with mouse, touch or left arrow)
    //
    N.MDEdit.__cm__.on('cursorActivity', function () {
      if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

      if (N.MDEdit.__cm__.somethingSelected()) {
        $popup.removeClass('emoji-autocomplete__m-visible');
        return;
      }

      var cursor = N.MDEdit.__cm__.getCursor();
      var line = N.MDEdit.__cm__.getDoc().getLine(cursor.line).substr(0, cursor.ch);

      if (!emojiAtEndRE.test(line)) {
        $popup.removeClass('emoji-autocomplete__m-visible');
        return;
      }

      showPopup(line.match(emojiAtEndRE)[1]);
    });


    // Insert emoji to text if clicked. We should use `mousedown` instead of `click`
    // because `click` could be canceled (if mouseup event cause when popup invisible)
    //
    $popup.on('mousedown touchstart', '.emoji-autocomplete-item__link', function () {
      insert($(this).data('value'));

      return false;
    });


    // Handle keypress if popup shown
    //
    N.MDEdit.__cm__.on('keydown', function (editor, event) {
      if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

      // `keyCode` for IE, `which` for others
      var code = event.which || event.keyCode;
      var $item;
      var $selected;

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
    });


    // Hide popup if focus lost
    //
    N.MDEdit.__cm__.on('blur', function () {
      // Wait 50 ms before hide popup to allow click by popup item
      setTimeout(function () {
        if (!$popup.hasClass('emoji-autocomplete__m-visible')) return;

        $popup.removeClass('emoji-autocomplete__m-visible');
      }, 50);
    });
  });
});
