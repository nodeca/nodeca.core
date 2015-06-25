'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function spoiler_plugin_init() {
    N.parse.addPlugin(
      'spoiler',
      require('nodeca.core/lib/parser/plugins/spoiler')(N)
    );
  });
};
