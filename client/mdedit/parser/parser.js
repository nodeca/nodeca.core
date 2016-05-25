// Init parser instance & emit event for plugins
//
'use strict';


const ParserBuilder = require('nodeca.core/lib/parser/index');


N.wire.once('init:assets', function () {
  N.parser = ParserBuilder;

  return N.wire.emit('init:parser', {});
});
