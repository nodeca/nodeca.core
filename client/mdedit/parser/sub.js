'use strict';

N.wire.once('init:parser', function sub_plugin_init() {
  N.parse.addPlugin(
    'sub',
    require('nodeca.core/lib/parser/plugins/sub')(N)
  );
});
