'use strict';

N.wire.once('init:parser', function emojis_plugin_init() {
  N.parse.addPlugin(
    'emojis',
    require('nodeca.core/lib/parser/plugins/emojis')(N, '$$ JSON.stringify(N.config.parser.emojis) $$')
  );
});
