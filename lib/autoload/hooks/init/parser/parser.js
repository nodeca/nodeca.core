// stores parser builder as `N.parse`
//
'use strict';


const ParserBuilder = require('nodeca.core/lib/parser/index');


module.exports = function (N) {
  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, async function parser_init() {
    N.parser = ParserBuilder;

    await N.wire.emit('init:parser', {});
  });
};
