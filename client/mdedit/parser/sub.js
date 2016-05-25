'use strict';

N.wire.once('init:parser', function subscript_plugin_init() {
  N.parser.addPlugin(
    'sub',
    require('nodeca.core/lib/parser/plugins/sub')(N)
  );
});
