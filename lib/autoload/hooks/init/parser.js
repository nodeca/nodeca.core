// stores parser as `N.parser`
//

'use strict';

var Parser = require('../../../parser/');


module.exports = function (N) {

  N.wire.after('init:bundle', function parser_init(__, callback) {
    N.parser = new Parser(N);

    N.wire.emit('init:parser', {}, callback);
  });
};
