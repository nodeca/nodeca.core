// Markdown-it plugin to parse cut marker in blog posts:
//
//     --cut--
//
// Renders to:
//
//     <!--cut-->
//

'use strict';


module.exports = function plugin(md, options) {
  /* eslint-disable max-depth */
  var expect = Array.from('--cut--').map(c => c.codePointAt(0));

  function cut(state, startLine, endLine, silent) {
    var ch, token, i,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;

    for (i = 0; i < expect.length && pos < max; i++, pos++) {
      ch = state.src.charCodeAt(pos);

      if (ch !== expect[i]) return false;
    }

    if (i !== expect.length) return false;

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) return false;

    if (silent) return true;

    state.line = startLine + 1;

    token        = state.push('cut_open', 'cut', 1);
    token.map    = [ startLine, state.line ];
    token.markup = '-';

    token        = state.push('cut_close', 'cut', -1);
    token.markup = '-';

    return true;
  }

  md.block.ruler.before('hr', 'cut', cut, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  });
  md.renderer.rules['cut_open'] = options.render;
  md.renderer.rules['cut_close'] = options.render;
};
