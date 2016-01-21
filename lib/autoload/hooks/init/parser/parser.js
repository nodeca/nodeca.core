// stores parser builder as `N.parse`
//
'use strict';


const ParserBuilder = require('nodeca.core/lib/parser/index');
const thenify       = require('thenify');


module.exports = function (N) {

  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, function* parser_init() {
    let addPlugin = ParserBuilder.addPlugin;

    N.parse = thenify.withCallback(ParserBuilder);
    N.parse.addPlugin = addPlugin;

    yield N.wire.emit('init:parser', {});
  });
};
