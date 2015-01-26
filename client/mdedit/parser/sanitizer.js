'use strict';

N.wire.once('init:parser', function sanitizer_plugin_init() {
  N.parse.addPlugin(
    'sanitizer',
    require('nodeca.core/lib/parser/plugins/sanitizer')(N, '$$ JSON.stringify(N.config.parser.sanitizer) $$')
  );
});
