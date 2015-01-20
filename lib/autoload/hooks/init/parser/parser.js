// stores parser builder as `N.parse`
//

'use strict';

var ParserBuilder = require('nodeca.core/lib/parser/index');

module.exports = function (N) {

  // After `models_init_done`
  N.wire.after('init:models', { priority: 20 }, function parser_init(__, callback) {
    N.parse = ParserBuilder;

    N.wire.emit('init:parser', {}, callback);
  });
};
