'use strict';

N.wire.once('init:parser', function superscript_plugin_init() {
  N.parser.addPlugin(
    'sup',
    require('nodeca.core/lib/parser/plugins/sup')(N)
  );
});
