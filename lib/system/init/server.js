// Initializes (start) HTTP and RPC server listeners.
// Used as last step in `cli/server.js`
//
// Emits sub events `init:server.https` and `init:server.http`
//


'use strict';


const _        = require('lodash');
const cluster  = require('cluster');
const co       = require('co');
const execFile = require('mz/child_process').execFile;
const os       = require('os');


module.exports = function (N) {

  N.wire.on('init:server', function* cluster_init(N) {
    let fork = N.config.fork;

    if (fork === 'auto' || fork === true || _.isUndefined(fork)) {
      fork = os.cpus().length;
    } else {
      fork = +fork || 0;
    }

    if (cluster.isMaster && (fork >= 1)) {
      yield new Promise(resolve => {
        function done() {
          resolve();
        }

        // Run queue worker
        cluster.setupMaster({ args: [ 'queue' ] });

        for (let i = 0; i < fork; i++) {
          let worker = cluster.fork();

          /* eslint-disable no-loop-func */
          /* eslint-disable no-catch-shadow */
          co(function* () {
            try {
              // Set scheduling policy to SCHED_IDLE (`-i` flag);
              // `0` is only possible value for priority ('cause this policy doesn't allow to set it)
              yield execFile('chrt', [ '-i', '-p', '0', worker.process.pid ]);
            } catch (__) {
              try {
                yield execFile('renice', [ '-n', '19', '-p', worker.process.pid ]);
                N.logger.warn('Cannot set scheduling policy for queue using `chrt`, falling back to `renice`');
              } catch (__) {
                N.logger.error('Cannot lower priority for queue ' +
                  '(both `renice` and `chrt` have failed), continuing with default priority');
              }
            }
          });
        }

        // Run server worker
        cluster.setupMaster({ args: [ 'worker' ] });

        for (let i = 0; i < fork; i++) {
          cluster.fork()
            .on('listening', done);
        }
      });
      return;
    }

    // If we are here - need worker deals
    yield N.wire.emit('init:server.worker', N);
    yield N.wire.emit('init:server.queue', N);
  });
};
