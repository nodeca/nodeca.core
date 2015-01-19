'use strict';

N.wire.once('init:parser', function quotes_plugin_init() {
  N.parse.addPlugin(
    'quotes',
    require('nodeca.core/lib/parser/plugins/quotes')(N)
  );
});
