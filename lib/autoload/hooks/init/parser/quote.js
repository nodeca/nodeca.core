'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function quote_plugin_init() {
    N.parse.addPlugin(
      'quote',
      require('nodeca.core/lib/parser/plugins/quote')(N)
    );
  });
};
