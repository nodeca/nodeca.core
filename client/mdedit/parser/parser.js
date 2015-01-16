// Init parser instance & emit event for plugins
//

'use strict';

var ParserBuilder = require('nodeca.core/lib/parser/index');

N.wire.once('init:assets', function (__, callback) {
  N.parse = ParserBuilder;

  N.wire.emit('init:parser', {}, callback);
});
