'use strict';

N.wire.once('init:parser', function medialinks_plugin_init() {
  N.parse.addPlugin(
    'medialinks',
    require('nodeca.core/lib/parser/plugins/medialinks')(N, '$$ JSON.stringify(N.config.parser.medialinks) $$')
  );
});
