'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function lists_plugin_init() {
    N.parse.addPlugin(
      'lists',
      require('nodeca.core/lib/parser/plugins/lists')(N)
    );
  });
};
