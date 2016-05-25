'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function emoji_plugin_init() {
    N.parser.addPlugin(
      'emoji',
      require('nodeca.core/lib/parser/plugins/emoji')(N, N.config.parser.emojis)
    );
  });
};
