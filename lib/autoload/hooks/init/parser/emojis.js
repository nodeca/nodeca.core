'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function emoji_plugin_init() {
    N.parse.addPlugin(
      'emojis',
      require('nodeca.core/lib/parser/plugins/emojis')(N, N.config.parser.emojis)
    );
  });
};
