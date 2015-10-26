// This is a main entry point. It bootstraps and starts application and all
// initializers. Workflow as follows:
//
//  -> runner.bootstrap
//      -> initialize
//          -> read main config and configs of all sub-applications
//          -> init logger
//          -> init all applications
//      -> exec cli
//          -> load CLI commands
//          -> run requested CLI command
//


'use strict';


// internal
var Application = require('./runner/application');
var stopwatch   = require('./init/utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


// dummy helper to beautify error.
// used when fatal error caught.
function formatError(err) {
  var msg, stack;

  msg   = String(err);
  stack = err.stack || '';

  if (err.original) {
    msg += '\n' + String(err.original);
    stack = err.original.stack || stack;
  }

  stack = stack.split('\n').slice(1).join('\n');

  if (stack) {
    msg += '\n' + stack;
  }

  return msg;
}


////////////////////////////////////////////////////////////////////////////////


exports.bootstrap = function (options) {
  var N = {
    io:       require('./io'),
    mainApp:  new Application(options),
    args:     process.argv.slice(2)
  };

  N.__startupTimer = stopwatch();


  function logFatalError(err) {
    /*eslint-disable no-console*/

    // Check for logger existence - if error happend while reading
    // application configs, logger objects may not be created.
    if (N.logger && N.logger.fatal) {
      N.logger.fatal(formatError(err));
    } else {
      console.error(formatError(err));
    }
  }

  //
  // Catch unexpected exceptions
  //

  process.on('uncaughtException', function (err) {
    logFatalError('UNCAUGHT EXCEPTION !!! ' + formatError(err));
  });

  //
  // Handle SIGnals
  //

  function shutdown_gracefully() {
    N.logger.info('Shutting down...');
    N.logger.shutdown(function () {
      process.exit(0);
    });
  }

  // shutdown gracefully on SIGTERM :
  process.on('SIGTERM', shutdown_gracefully);
  process.on('SIGINT',  shutdown_gracefully);

  // Notify about unclean exit
  process.on('SIGQUIT', function () {
    N.logger.shutdown(function () {
      process.exit(1);
    });
  });


  try {
    // preload & bootstrap
    require('./runner/initialize')(N);

    // Load 'init:**' events handlers
    require('./init')(N);

    // execute cli script
    require('./runner/exec_cli')(N, function (err) {
      if (err) {
        logFatalError(err);
        process.exit(1);
        return;
      }
    });
  } catch (err) {
    logFatalError(err);
    process.exit(1);
    return;
  }
};
