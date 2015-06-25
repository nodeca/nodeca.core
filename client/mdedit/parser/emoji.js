'use strict';

N.wire.once('init:parser', function emoji_plugin_init() {
  N.parse.addPlugin(
    'emoji',
    require('nodeca.core/lib/parser/plugins/emoji')(N, '$$ JSON.stringify(N.config.parser.emojis) $$')
  );
});
