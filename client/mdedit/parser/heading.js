'use strict';

N.wire.once('init:parser', function heading_plugin_init() {
  N.parser.addPlugin(
    'heading',
    require('nodeca.core/lib/parser/plugins/heading')(N)
  );
});
