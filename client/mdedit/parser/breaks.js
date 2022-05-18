// Convert linefeed (\n) to <br>
//
'use strict';

N.wire.once('init:parser', function breaks_plugin_init() {
  N.parser.addPlugin(
    'breaks',
    require('nodeca.core/lib/parser/plugins/breaks')(N)
  );
});
