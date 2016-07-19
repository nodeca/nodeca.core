'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function code_block_plugin_init() {
    N.parser.addPlugin(
      'code',
      require('nodeca.core/lib/parser/plugins/code')(N)
    );

    N.parser.addPlugin(
      'code:override_highlighter',
      function (parser) {
        // override highlighter with full version (with all languages)
        parser.md.highlighter = require('highlight.js');
      }
    );
  });
};
