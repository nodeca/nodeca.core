'use strict';

N.wire.once('init:parser', function list_plugin_init() {
  N.parser.addPlugin(
    'list',
    require('nodeca.core/lib/parser/plugins/list')(N)
  );
});
