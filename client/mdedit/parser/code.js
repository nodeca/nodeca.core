'use strict';

N.wire.once('init:parser', function code_block_plugin_init() {
  N.parser.addPlugin(
    'code',
    require('nodeca.core/lib/parser/plugins/code')(N)
  );
});
