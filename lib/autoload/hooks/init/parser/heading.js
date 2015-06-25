'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function heading_plugin_init() {
    N.parse.addPlugin(
      'heading',
      require('nodeca.core/lib/parser/plugins/heading')(N)
    );
  });
};
