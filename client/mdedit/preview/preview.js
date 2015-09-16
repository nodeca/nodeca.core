'use strict';


var _ = require('lodash');


N.wire.once('init:mdedit', function () {

  // Set initial value
  N.MDEdit.__scrollMap__ = null;


  // Build offsets for each line
  //
  function buildScrollMap() {
    var $preview = N.MDEdit.__layout__.find('.mdedit__preview'),
      offset = $preview.offset().top - $preview.scrollTop(),
      mappedLinesNumbers = [],
      lineHeightMap = [],
      scrollMap = [],
      lineCount = 0,
      pos = 0,
      line, $el, lh, i, a, b;

    // Calculate wrapped lines count and fill map real->wrapped
    lh = parseInt(N.MDEdit.__layout__.find('.CodeMirror-code > pre:first').css('lineHeight'), 10);
    N.MDEdit.__cm__.eachLine(function (lineHandle) {
      lineHeightMap.push(lineCount);
      lineCount += lineHandle.height / lh;
    });

    // Init `scrollMap` array
    for (i = 0; i < lineCount; i++) {
      scrollMap.push(-1);
    }

    // Define first line offset
    mappedLinesNumbers.push(0);
    scrollMap[0] = 0;

    // Get mapped lines offsets and fill mapped lines numbers
    N.MDEdit.__layout__.find('.mdedit__preview > [data-line]').each(function () {
      $el = $(this);
      line = lineHeightMap[$el.data('line')];

      if (line === 0) {
        return;
      }

      scrollMap[line] = $el.offset().top - offset;

      if (line !== lineCount - 1) {
        mappedLinesNumbers.push(line);
      }
    });

    // Define last line offset
    scrollMap[lineCount - 1] = $preview.get(0).scrollHeight;
    mappedLinesNumbers.push(lineCount - 1);

    // Interpolate offset of lines between mapped lines
    for (i = 0; i < scrollMap.length; i++) {
      if (scrollMap[i] !== -1) {
        pos++;
        continue;
      }

      a = mappedLinesNumbers[pos - 1];
      b = mappedLinesNumbers[pos];

      scrollMap[i] = Math.round((scrollMap[b] * (i - a) + scrollMap[a] * (b - i)) / (b - a));
    }

    N.MDEdit.__scrollMap__ = scrollMap;
  }


  // Update preview and save draft
  //
  N.wire.on('mdedit:update.*', _.debounce(function updatePreview() {
    if (!N.MDEdit.__layout__) { return; }

    N.MDEdit.__layout__.trigger('change');

    N.parse(
      {
        text: N.MDEdit.text(),
        attachments: N.MDEdit.attachments().map(function (attach) {
          return attach.media_id;
        }),
        options: N.MDEdit.__options__.parseOptions,
        rpc_cache: N.MDEdit.__cache__
      },
      function (err, result) {
        if (err) {
          // It should never happen
          N.wire.emit('notify', { type: 'error', message: err.message });
          return;
        }

        if (!N.MDEdit.__layout__) { return; }

        N.MDEdit.__layout__.find('.mdedit__preview').html(N.runtime.render('mdedit.preview', {
          user_hid: N.runtime.user_hid,
          html: result.html,
          attachments: result.tail
        }));

        N.MDEdit.__scrollMap__ = null;
      }
    );
  }, 500, { maxWait: 500, leading: true }));


  // Init scroll listeners to synchronize position between editor and preview
  //
  N.wire.on('mdedit:init', function initSyncScroll() {
    var $preview = N.MDEdit.__layout__.find('.mdedit__preview');
    var $editor = N.MDEdit.__layout__.find('.CodeMirror-scroll');
    var editorScroll, previewScroll;

    // When user resize window - remove outdated scroll map
    $(window).on('resize.nd.mdedit', function () {
      N.MDEdit.__scrollMap__ = null;
    });

    // Editor scroll handler
    //
    editorScroll = _.debounce(function () {
      if (!N.MDEdit.__scrollMap__) {
        buildScrollMap();
      }

      // Get top visible editor line number
      var lh = parseInt(N.MDEdit.__layout__.find('.CodeMirror-code > pre:first').css('lineHeight'), 10);
      var line = Math.round(N.MDEdit.__cm__.getScrollInfo().top / lh);
      // Get preview offset
      var posTo = N.MDEdit.__scrollMap__[line];

      // Remove scroll handler for preview when scroll it programmatically
      $preview.off('scroll.nd.mdedit');

      $preview.stop(true).animate({ scrollTop: posTo }, 'fast', 'linear', function () {
        // Restore scroll handler after 50 ms delay to avoid non-user scroll events
        setTimeout(function () {
          $preview.on('scroll.nd.mdedit', previewScroll);
        }, 50);
      });
    }, 50, { maxWait: 50 });


    // Preview scroll handler
    //
    previewScroll = _.debounce(function () {
      if (!N.MDEdit.__scrollMap__) {
        buildScrollMap();
      }

      var scrollTop = $preview.scrollTop();
      var line;

      // Get editor line number by preview offset
      for (line = 0; line < N.MDEdit.__scrollMap__.length; line++) {
        if (N.MDEdit.__scrollMap__[line] >= scrollTop) {
          break;
        }
      }

      var lh = parseInt(N.MDEdit.__layout__.find('.CodeMirror-code > pre:first').css('lineHeight'), 10);
      var posTo = line * lh;

      // Remove scroll handler for editor when scroll it programmatically
      $editor.off('scroll.nd.mdedit');

      $editor.stop(true).animate({ scrollTop: posTo }, 'fast', 'linear', function () {
        // Restore scroll handler after 50 ms delay to avoid non-user scroll events
        setTimeout(function () {
          $editor.on('scroll.nd.mdedit', editorScroll);
        }, 50);
      });
    }, 50, { maxWait: 50 });


    // Bind events
    $editor.on('scroll.nd.mdedit', editorScroll);
    $preview.on('scroll.nd.mdedit', previewScroll);
  });
});
