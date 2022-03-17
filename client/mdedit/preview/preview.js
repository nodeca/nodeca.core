'use strict';


const _ = require('lodash');
const textarea_to_div = require('../_lib/textarea_to_div');


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
        charPos = 0,
        pos = 0,
        div,
        line, $el, lh, i, a, b;

    lh = parseInt(window.getComputedStyle(N.MDEdit.__textarea__).lineHeight, 10);

    function positionToRect(start, end) {
      let range = document.createRange();
      range.setStart(div.childNodes[0], start);
      range.setEnd(div.childNodes[0], end);

      let divRect = div.getBoundingClientRect();
      let textRect = range.getBoundingClientRect();

      return new DOMRect(textRect.x - divRect.x, textRect.y - divRect.y, textRect.width, textRect.height);
    }

    div = textarea_to_div(N.MDEdit.__textarea__);
    div.textContent = N.MDEdit.__textarea__.value || ' ';

    // Calculate wrapped lines count and fill map real->wrapped
    for (let line of N.MDEdit.__textarea__.value.split(/\n/g)) {
      lineHeightMap.push(lineCount);
      lineCount += Math.round(positionToRect(charPos, charPos + line.length).height / lh);
      charPos += line.length + 1;
    }

    div.remove();

    // Init `scrollMap` array
    for (i = 0; i < lineCount; i++) {
      scrollMap.push(-1);
    }

    // Define first line offset
    mappedLinesNumbers.push(0);
    scrollMap[0] = 0;

    // Get mapped lines offsets and fill mapped lines numbers
    N.MDEdit.__layout__.find('.mdedit__preview > .markup > [data-line]').each(function () {
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


  // When user types in editor, scroll to corresponding text in preview
  //
  function editorShowCursor() {
    if (!N.MDEdit.__scrollMap__) {
      buildScrollMap();
    }

    let line = (N.MDEdit.__textarea__.value.slice(0, N.MDEdit.__textarea__.selectionStart).match(/\n/g) || []).length;
    let paragraph;

    while (line >= 0) {
      paragraph = N.MDEdit.__layout__.find(`.mdedit__preview > .markup > [data-line="${line}"]`)[0];
      if (paragraph) break;
      line--;
    }

    if (!paragraph) return;

    let parentRect = N.MDEdit.__layout__.find('.mdedit__preview')[0].getBoundingClientRect();
    let paragraphRect = paragraph.getBoundingClientRect();

    if (paragraphRect.top - parentRect.top < 0) {
      paragraph.scrollIntoView(true);
    } else if (paragraphRect.height <= parentRect.height && paragraphRect.bottom > parentRect.bottom) {
      paragraph.scrollIntoView(false);
    }
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

        N.MDEdit.__layout__.find('.mdedit__preview > .markup').html(result.html);
        N.MDEdit.__scrollMap__ = null;
        editorShowCursor();
      })
      // It should never happen
      .catch(err => N.wire.emit('notify', err.message));
  }, 500, { maxWait: 500, leading: true }));


  // Init scroll listeners to synchronize position between editor and preview
  //
  N.wire.on('mdedit:init', function initSyncScroll() {
    let $preview = N.MDEdit.__layout__.find('.mdedit__preview');
    let $editor = N.MDEdit.__layout__.find('.mdedit__edit-area');
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
      let lh = parseInt(window.getComputedStyle(N.MDEdit.__textarea__).lineHeight, 10);

      let editorScrollTop     = N.MDEdit.__textarea__.scrollTop;
      let editorClientHeight  = N.MDEdit.__textarea__.clientHeight;
      let editorScrollHeight  = N.MDEdit.__textarea__.scrollHeight;
      let previewClientHeight = $preview[0].clientHeight;

      let interpCoef = editorScrollTop / (editorScrollHeight - editorClientHeight);
      let editorScrollTopInterpolated = (
        editorScrollTop * (1 - interpCoef) +
        (editorScrollTop + editorClientHeight) * interpCoef
      );

      let line = Math.round(editorScrollTopInterpolated / lh);
      if (line >= N.MDEdit.__scrollMap__.length) line = N.MDEdit.__scrollMap__.length - 1;
      // Get preview offset
      let posTo = N.MDEdit.__scrollMap__[line];

      // Remove scroll handler for preview when scroll it programmatically
      $preview.off('scroll.nd.mdedit');

      $preview.stop(true).animate({
        scrollTop: posTo - previewClientHeight * interpCoef
      }, 'fast', 'linear', function () {
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

      let previewScrollTop    = $preview[0].scrollTop;
      let previewClientHeight = $preview[0].clientHeight;
      let previewScrollHeight = $preview[0].scrollHeight;
      let editorClientHeight  = N.MDEdit.__textarea__.clientHeight;

      let interpCoef = previewScrollTop / (previewScrollHeight - previewClientHeight);
      let previewScrollTopInterpolated = (
        previewScrollTop * (1 - interpCoef) +
        (previewScrollTop + previewClientHeight) * interpCoef
      );

      let line;

      // Get editor line number by preview offset
      for (line = 0; line < N.MDEdit.__scrollMap__.length; line++) {
        if (N.MDEdit.__scrollMap__[line] >= previewScrollTopInterpolated) break;
      }

      let lh = parseInt(window.getComputedStyle(N.MDEdit.__textarea__).lineHeight, 10);
      let posTo = line * lh - editorClientHeight * interpCoef;

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
