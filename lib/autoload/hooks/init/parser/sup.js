'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function superscript_plugin_init() {
    N.parse.addPlugin(
      'sup',
      require('nodeca.core/lib/parser/plugins/sup')(N)
    );
  });
};
