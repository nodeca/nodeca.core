'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function smiles_plugin_init() {
    N.parse.addPlugin(
      'smiles',
      require('nodeca.core/lib/parser/plugins/smiles')(N)
    );
  });
};
