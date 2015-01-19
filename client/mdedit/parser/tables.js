'use strict';

N.wire.once('init:parser', function tables_plugin_init() {
  N.parse.addPlugin(
    'tables',
    require('nodeca.core/lib/parser/plugins/tables')(N)
  );
});
