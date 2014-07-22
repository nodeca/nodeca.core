// stores parser as `N.parser`
//

'use strict';

var Parser = require('../../../parser/');


module.exports = function (N) {

  N.wire.before('init:models', function parser_init() {
    N.parser = new Parser();
  });
};
