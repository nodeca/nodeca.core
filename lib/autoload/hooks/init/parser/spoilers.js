'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function spoiler_plugin_init() {
    N.parse.addPlugin(
      'spoilers',
      require('nodeca.core/lib/parser/plugins/spoilers')(N)
    );
  });
};
