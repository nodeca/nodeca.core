'use strict';

N.wire.once('init:parser', function footnote_plugin_init() {
  N.parse.addPlugin(
    'footnote',
    require('nodeca.core/lib/parser/plugins/footnote')(N)
  );
});
