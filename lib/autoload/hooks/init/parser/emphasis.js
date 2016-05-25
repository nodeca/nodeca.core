'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function emphasis_plugin_init() {
    N.parser.addPlugin(
      'emphasis',
      require('nodeca.core/lib/parser/plugins/emphasis')(N)
    );
  });
};
