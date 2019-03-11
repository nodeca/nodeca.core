'use strict';


const _ = require('lodash');


N.wire.once('init:mdedit', function () {

  // Set initial value
  N.MDEdit.__scrollMap__ = null;


  // Build offsets for each line
  //
  function buildScrollMap() {
    let $preview = N.MDEdit.__layout__.find('.mdedit__preview'),
        offset = $preview.offset().top - $preview.scrollTop(),
        mappedLinesNumbers = [],
        lineHeightMap = [],
        scrollMap = [],
        lineCount = 0,
        pos = 0,
        line, $el, lh, i, a, b;

    // Calculate wrapped lines count and fill map real->wrapped
    lh = N.MDEdit.__cm__.defaultTextHeight();
    N.MDEdit.__cm__.eachLine(lineHandle => {
      lineHeightMap.push(lineCount);
      lineCount += Math.round(lineHandle.height / lh);
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

      if (line === 0) return;

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
    if (!N.MDEdit.__layout__) return;

    N.MDEdit.__layout__.trigger('change');

    N.parser.md2html({
      text: N.MDEdit.text(),
      options: N.MDEdit.__options__.parseOptions,
      rpc_cache: N.MDEdit.__cache__
    })
      .then(result => {
        if (!N.MDEdit.__layout__) return;

        N.MDEdit.__layout__.find('.mdedit__preview').html(result.html);
        N.MDEdit.__scrollMap__ = null;
      })
      // It should never happen
      .catch(err => N.wire.emit('notify', err.message));
  }, 500, { maxWait: 500, leading: true }));


  // Init scroll listeners to synchronize position between editor and preview
  //
  N.wire.on('mdedit:init', function initSyncScroll() {
    let $preview = N.MDEdit.__layout__.find('.mdedit__preview');
    let $editor = N.MDEdit.__layout__.find('.CodeMirror-scroll');
    let editorScroll, previewScroll;

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
      let lh = N.MDEdit.__cm__.defaultTextHeight();
      let line = Math.round(N.MDEdit.__cm__.getScrollInfo().top / lh);
      // Get preview offset
      let posTo = N.MDEdit.__scrollMap__[line];

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

      let scrollTop = $preview.scrollTop();
      let line;

      // Get editor line number by preview offset
      for (line = 0; line < N.MDEdit.__scrollMap__.length; line++) {
        if (N.MDEdit.__scrollMap__[line] >= scrollTop) break;
      }

      let lh = N.MDEdit.__cm__.defaultTextHeight();
      let posTo = line * lh;

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
