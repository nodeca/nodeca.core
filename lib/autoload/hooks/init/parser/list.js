'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function list_plugin_init() {
    N.parse.addPlugin(
      'list',
      require('nodeca.core/lib/parser/plugins/list')(N)
    );
  });
};
