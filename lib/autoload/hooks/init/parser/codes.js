'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function code_blocks_plugin_init() {
    N.parse.addPlugin(
      'codes',
      require('nodeca.core/lib/parser/plugins/codes')(N)
    );
  });
};
