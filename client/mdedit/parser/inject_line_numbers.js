// Inject line numbers for sync scroll. Notes:
//
// - We track only headings and paragraphs on first level. That's enough.
// - Footnotes content causes jumps. Level limit filter it automatically.
//
'use strict';

/*eslint-disable consistent-this*/

N.wire.once('init:parser', function inject_line_numbers_plugin_init() {

  function injectLineNumbers(tokens, idx, options, env, self) {
    var line;
    if (tokens[idx].map && tokens[idx].level === 0) {
      line = tokens[idx].map[0];
      tokens[idx].attrPush([ 'data-line', String(line) ]);
    }
    return self.renderToken(tokens, idx, options, env, self);
  }

  N.parser.addPlugin(
    'injectLineNumbers',
    function (parser) {
      parser.md.renderer.rules.paragraph_open = parser.md.renderer.rules.heading_open = injectLineNumbers;
    },
    true
  );
});
