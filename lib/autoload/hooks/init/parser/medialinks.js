'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function medialinks_plugin_init() {
    N.parse.addPlugin(
      'medialinks',
      require('nodeca.core/lib/parser/plugins/medialinks')(N, N.config.parser.medialinks)
    );
  });
};
