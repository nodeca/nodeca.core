'use strict';

module.exports = function (/*N*/) {

// Sanitizer disabled, because the output of the markdown parser is already
// trusted, so sanitizer does not gain any additional security.
/*
  N.wire.once('init:parser', function sanitizer_plugin_init() {
    N.parse.addPlugin(
      'sanitizer',
      require('nodeca.core/lib/parser/plugins/sanitizer')(N, N.config.parser.sanitizer)
    );
  });
*/
};
