// Init parser instance & emit event for plugins
//

'use strict';

var Parser = require('ndparser');


N.wire.once('init:assets', function (__, callback) {
  N.parser = new Parser(N);

  N.wire.emit('init:parser', {}, callback);
});
