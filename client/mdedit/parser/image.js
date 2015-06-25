'use strict';

N.wire.once('init:parser', function image_plugin_init() {
  N.parse.addPlugin(
    'image',
    require('nodeca.core/lib/parser/plugins/image')(N)
  );
});
