// Start worker (queue part)
//

'use strict';


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp: true,
  help: 'start worker (queue)',
  description: 'Start worker (queue)'
};


module.exports.commandLineArguments = [];


////////////////////////////////////////////////////////////////////////////////

module.exports.run = function (N/*, args*/) {
  return N.wire.emit([
    'init:models',
    'init:server.queue'
  ], N);
};
