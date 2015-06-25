'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function medialink_plugin_init() {
    N.parse.addPlugin(
      'medialink',
      require('nodeca.core/lib/parser/plugins/medialink')(N, N.config.parser.medialinks)
    );
  });
};
