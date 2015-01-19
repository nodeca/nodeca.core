'use strict';

N.wire.once('init:parser', function images_plugin_init() {
  N.parse.addPlugin(
    'images',
    require('nodeca.core/lib/parser/plugins/images')(N)
  );
});
