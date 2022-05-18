// Convert linefeed (\n) to <br>
//
'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function breaks_plugin_init() {
    N.parser.addPlugin(
      'breaks',
      require('nodeca.core/lib/parser/plugins/breaks')(N)
    );
  });
};
