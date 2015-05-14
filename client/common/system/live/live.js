// Emit `init:live` for plugins & add live instance to 'N'
//
'use strict';


var Live          = require('nodeca.core/lib/live');
var FayeTransport = require('nodeca.core/lib/live/transports/faye');


// Emit event for connectors & add live instance to 'N' (after init `N.runtime`)
//
N.wire.once('init:assets', function live_init(__, callback) {
  var transport = new FayeTransport('/io/live', function () {
    return N.runtime.token_live;
  });

  transport.onerror = function (error) {
    N.wire.emit('io.error', error.code ? error : { message: error });
  };

  N.live = new Live({
    transport: transport
  });

  N.wire.emit('init:live', {}, callback);
});
