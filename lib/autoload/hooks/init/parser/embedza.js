// This needed only for preview, see `link_expand` plugin instead
//
'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function embedza_plugin_init() {
    N.parser.addPlugin(
      'embedza',
      require('nodeca.core/lib/parser/plugins/embedza')(N)
    );
  });
};
