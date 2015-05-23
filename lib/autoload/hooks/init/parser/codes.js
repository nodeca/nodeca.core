'use strict';

module.exports = function (N) {
  var init;

  N.wire.once('init:parser', function code_blocks_plugin_init() {
    init = require('nodeca.core/lib/parser/plugins/codes')(N);

    N.parse.addPlugin(
      'codes',
      function (parser) {
        init(parser);
        // override highlighter with full version (with all languages)
        parser.md.highlighter = require('highlight.js');
      }
    );
  });
};
