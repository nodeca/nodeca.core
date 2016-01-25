// Start worker (server part)
//

'use strict';


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp: true,
  help: 'start worker (server)',
  description: 'Start worker (server)'
};


module.exports.commandLineArguments = [];


////////////////////////////////////////////////////////////////////////////////

module.exports.run = function (N/*, args*/) {
  return N.wire.emit([
    'init:models',
    'init:bundle',
    'init:server.worker'
  ], N);
};
