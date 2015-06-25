'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function subscript_plugin_init() {
    N.parse.addPlugin(
      'sub',
      require('nodeca.core/lib/parser/plugins/sub')(N)
    );
  });
};
