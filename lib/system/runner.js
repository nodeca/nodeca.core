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


const co          = require('co');
const Application = require('./runner/application');
const stopwatch   = require('./init/utils/stopwatch');
const cluster     = require('cluster');


////////////////////////////////////////////////////////////////////////////////


// dummy helper to beautify error.
// used when fatal error caught.
function formatError(err) {
  let msg   = String(err);
  let stack = err.stack || '';

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
    args:     process.argv.slice(2),
    shutdown:  code => {
      if (N.logger && N.logger.shutdown) {
        N.logger.shutdown(function () {
          process.exit(code || 0);
        });
        return;
      }

      process.exit(code || 0);
    }
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
    N.wire.emit('shutdown', N).then(
      () => { N.shutdown(); },
      err => {
        logFatalError(err);
        N.shutdown();
      }
    );
  }

  function reload() {
    N.logger.info('Reloading...');
    N.wire.emit('reload', N).catch(err => {
      logFatalError(err);
    });
  }

  // shutdown gracefully on SIGTERM :
  process.on('SIGTERM', shutdown_gracefully);
  process.on('SIGINT',  shutdown_gracefully);

  // restart workers on sighup
  process.on('SIGHUP',  reload);

  // Notify about unclean exit
  process.on('SIGQUIT', function () {
    N.shutdown(1);
  });


  co(function* () {
    // preload & bootstrap
    require('./runner/initialize')(N);
    // Load 'init:**' events handlers
    require('./init')(N);

    // execute cli script
    yield require('./runner/exec_cli')(N);

    if (cluster.isWorker) {
      process.send('worker.running');
    }
  })
  .catch(err => {
    logFatalError(err);
    N.shutdown(1);
  });
};
