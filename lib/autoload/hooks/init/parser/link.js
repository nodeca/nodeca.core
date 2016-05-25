'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function link_plugin_init() {
    N.parser.addPlugin(
      'link',
      require('nodeca.core/lib/parser/plugins/link')(N)
    );
  });
};
