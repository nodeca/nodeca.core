'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function horizontal_rules_plugin_init() {
    N.parse.addPlugin(
      'hrs',
      require('nodeca.core/lib/parser/plugins/hrs')(N)
    );
  });
};
