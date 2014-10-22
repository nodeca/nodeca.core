'use strict';

var Remarkable = require('remarkable');
var escapeHtml = require('remarkable/lib/common/utils').escapeHtml;


function cutPlugin(remarkable) {
  remarkable.block.ruler.after('code', function cut(state, startLine/*, endLine, silent*/) {
    var
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

    if (pos >= max) {
      return false;
    }

    if (state.src.charCodeAt(pos) !== 0x7B/* { */ && state.src.charCodeAt(pos + 1) !== 0x25/* % */) {
      return false;
    }

    pos = state.skipSpaces(pos + 2);

    if (pos >= max - 3 || state.src.substr(pos, 3) !== 'cut') {
      return false;
    }

    pos = state.skipSpaces(pos + 3);

    max = state.skipCharsBack(max, 0x20/* space */, pos);

    if (state.src.charCodeAt(max - 1) !== 0x7D/* } */ && state.src.charCodeAt(max - 2) !== 0x25/* % */) {
      return false;
    }

    max = state.skipCharsBack(max - 2, 0x20/* space */, pos);

    state.line = startLine + 1;

    state.tokens.push({
      type: 'cut',
      content: state.src.substr(pos, max - pos),
      lines: [ startLine, state.line ]
    });

    return true;
  });

  remarkable.renderer.rules.cut = function (tokens, idx /*, options*/) {
    return '<cut>' + escapeHtml(tokens[idx].content) + '</cut>';
  };
}


module.exports = function (data, callback) {

  var md = new Remarkable({
    html: true
  });

  md.use(cutPlugin);

  // TODO: implement spoiler plugin

  data.output = md.render(data.input);

  callback();
};
