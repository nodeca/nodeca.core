'use strict';

N.wire.once('init:parser', function footnote_plugin_init() {
  N.parser.addPlugin(
    'footnote',
    require('nodeca.core/lib/parser/plugins/footnote')(N)
  );
});
