// Start server
//

'use strict';


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp:      true,
  help:         'start nodeca server',
  description:  'Start nodeca server'
};


module.exports.commandLineArguments = [];

module.exports.run = function (N/*, args*/) {
  return N.wire.emit([
    'init:models',
    'init:bundle',
    'init:server'
  ], N);
};
