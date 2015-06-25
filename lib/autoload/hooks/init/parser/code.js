'use strict';

module.exports = function (N) {
  var init;

  N.wire.once('init:parser', function code_block_plugin_init() {
    init = require('nodeca.core/lib/parser/plugins/code')(N);

    N.parse.addPlugin(
      'code',
      function (parser) {
        init(parser);
        // override highlighter with full version (with all languages)
        parser.md.highlighter = require('highlight.js');
      }
    );
  });
};
