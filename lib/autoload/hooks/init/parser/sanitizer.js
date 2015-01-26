'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function sanitizer_plugin_init() {
    N.parse.addPlugin(
      'sanitizer',
      require('nodeca.core/lib/parser/plugins/sanitizer')(N, N.config.parser.sanitizer)
    );
  });
};
