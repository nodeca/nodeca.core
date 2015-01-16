'use strict';

N.wire.once('init:parser', function medialinks_plugin_init() {
  N.parse.addPlugin(
    'links',
    require('nodeca.core/lib/parser/plugins/links')(N)
  );
});
