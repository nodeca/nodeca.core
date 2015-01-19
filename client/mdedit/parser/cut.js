'use strict';

N.wire.once('init:parser', function cut_plugin_init() {
  N.parse.addPlugin(
    'cut',
    require('nodeca.core/lib/parser/plugins/cut')(N)
  );
});
