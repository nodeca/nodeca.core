'use strict';

N.wire.once('init:parser', function footnotes_plugin_init() {
  N.parse.addPlugin(
    'footnotes',
    require('nodeca.core/lib/parser/plugins/footnotes')(N)
  );
});
