// Dump merged config (simplifies debug)
//

'use strict';


const inspect = require('util').inspect;


////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp:      true,
  help:         'dump merged config for all apps',
  description:  'Dump merged config for all apps'
};


module.exports.commandLineArguments = [
];


module.exports.run = function (N/*, args */) {
  // Reduce log level
  N.logger.setLevel('info');

  return Promise.resolve().then(() => {
    // Don't emit any events

    /*eslint-disable no-console*/
    console.log(inspect(N.config, { depth: null, colors: true }));
  });
};
