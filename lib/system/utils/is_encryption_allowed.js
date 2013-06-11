// Checks if server method by the given ApiPath supports SSL connections.
// If ApiPath is not proveded - checks for global SSL support.


'use strict';


var findBindConfig = require('./find_bind_config');


module.exports = function isEncryptionAllowed(N, apiPath) {
  var bind = apiPath ? findBindConfig(N, apiPath) : N.config.bind['default'];

  return Boolean(bind && bind.ssl);
};
