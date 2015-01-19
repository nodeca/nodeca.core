'use strict';

N.wire.once('init:parser', function links_plugin_init() {
  N.parse.addPlugin(
    'links',
    require('nodeca.core/lib/parser/plugins/links')(N)
  );
});
