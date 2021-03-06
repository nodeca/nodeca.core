'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function horizontal_rule_plugin_init() {
    N.parser.addPlugin(
      'hr',
      require('nodeca.core/lib/parser/plugins/hr')(N)
    );
  });
};
