// stores parser builder as `N.parse`
//
'use strict';


const Promise       = require('bluebird');
const ParserBuilder = require('nodeca.core/lib/parser/index');


// In server mode use faster libs on internal parcer bus
ParserBuilder.Promise = Promise;
ParserBuilder.co      = (fn, params) => Promise.coroutine(fn)(params);


module.exports = function (N) {
  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, async function parser_init() {
    N.parser = ParserBuilder;

    await N.wire.emit('init:parser', {});
  });
};
