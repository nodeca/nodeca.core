'use strict';

N.wire.once('init:parser', function spoiler_plugin_init() {
  N.parser.addPlugin(
    'spoiler',
    require('nodeca.core/lib/parser/plugins/spoiler')(N)
  );
});
