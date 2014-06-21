// Dump merged config (simplifies debug)
//

'use strict';


var inspect = require('util').inspect;


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp:      true,
  help:         'dump merged config for all apps',
  description:  'Dump merged config for all apps'
};


module.exports.commandLineArguments = [
];


module.exports.run = function (N/*, args, callback*/) {

  // Reduce log level
  N.logger.setLevel('info');

  /*eslint no-console:0*/

  // Don't emit any events
  console.log(inspect(N.config, { depth: null, colors: true }));

  process.exit(0);
};
