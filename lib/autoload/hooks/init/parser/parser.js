// stores parser builder as `N.parse`
//
'use strict';


const ParserBuilder = require('nodeca.core/lib/parser/index');


// In server mode use faster libs on internal parcer bus
ParserBuilder.Promise = require('bluebird');
ParserBuilder.co      = require('bluebird-co').co;


module.exports = function (N) {

  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, function* parser_init() {
    N.parse           = ParserBuilder;
    N.parse.addPlugin = ParserBuilder.addPlugin;

    yield N.wire.emit('init:parser', {});
  });
};
