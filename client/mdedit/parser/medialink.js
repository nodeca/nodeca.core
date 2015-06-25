'use strict';

N.wire.once('init:parser', function medialink_plugin_init() {
  N.parse.addPlugin(
    'medialink',
    require('nodeca.core/lib/parser/plugins/medialink')(N, '$$ JSON.stringify(N.config.parser.medialinks) $$')
  );
});
