'use strict';

N.wire.once('init:parser', function table_plugin_init() {
  N.parser.addPlugin(
    'table',
    require('nodeca.core/lib/parser/plugins/table')(N)
  );
});
