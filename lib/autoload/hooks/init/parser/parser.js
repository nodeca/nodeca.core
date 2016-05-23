// stores parser builder as `N.parse`
//
'use strict';


const ParserBuilder = require('nodeca.core/lib/parser/index');
const thenify       = require('thenify');


// In server mode use faster libs on internal parcer bus
ParserBuilder.Promise = require('bluebird');
ParserBuilder.co      = require('bluebird-co').co;


module.exports = function (N) {

  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, function* parser_init() {
    let addPlugin = ParserBuilder.addPlugin;

    N.parse = thenify.withCallback(ParserBuilder);
    N.parse.addPlugin = addPlugin;

    yield N.wire.emit('init:parser', {});
  });
};
