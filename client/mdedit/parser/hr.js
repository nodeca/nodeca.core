'use strict';

N.wire.once('init:parser', function horizontal_rule_plugin_init() {
  N.parse.addPlugin(
    'hr',
    require('nodeca.core/lib/parser/plugins/hr')(N)
  );
});
