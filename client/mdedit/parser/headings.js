'use strict';

N.wire.once('init:parser', function headings_plugin_init() {
  N.parse.addPlugin(
    'headings',
    require('nodeca.core/lib/parser/plugins/headings')(N)
  );
});
