'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function table_plugin_init() {
    N.parse.addPlugin(
      'table',
      require('nodeca.core/lib/parser/plugins/table')(N)
    );
  });
};
