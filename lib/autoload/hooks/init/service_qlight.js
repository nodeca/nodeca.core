// Expose queue to `N.queue`, register available jobs
//

'use strict';


const _            = require('lodash');
const Promise      = require('bluebird');
const cluster      = require('cluster');
const execFile     = require('mz/child_process').execFile;
const os           = require('os');
const Queue        = require('ido');
const WorkerPool   = require('nodeca.core/lib/system/worker_pool');


module.exports = function (N) {

  let active_pools = [];

  N.wire.on('init:services', { parallel: true }, function* worker_pool_queue_init(N) {
    let fork = (N.config.fork || {}).qlight;

    if (fork === 'auto') {
      fork = os.cpus().length;
    } else {
      fork = +fork || 0;
    }

    if (!cluster.isMaster || fork < 1) {
      // single process mode
      yield N.wire.emit('init:services.qlight', N);
      return;
    }

    let pool = new WorkerPool('qlight', fork);

    active_pools.push(pool);

    pool.on('worker:spawn',  pid         => N.logger.info(`Worker ${pid} spawned`));
    pool.on('worker:error',  error       => N.logger.error(error));
    pool.on('worker:online', pid         => N.logger.info(`Worker ${pid} is running`));
    pool.on('worker:exit',   (pid, code) => N.logger.info(`Worker ${pid} exited with status ${code}`));

    pool.on('worker:online', Promise.coroutine(function* (pid) {
      try {
        // Set scheduling policy to SCHED_IDLE (`-i` flag);
        // `0` is only possible value for priority ('cause this policy doesn't allow to set it)
        yield execFile('chrt', [ '-i', '-p', '0', pid ]);
      } catch (__) {
        // If `chrt` not exists, try fallback to `renice`.
        try {
          yield execFile('renice', [ '-n', '19', '-p', pid ]);
          N.logger.warn('Cannot set scheduling policy for queue using `chrt`, falling back to `renice`');
        } catch (___) {
          N.logger.error('Cannot lower priority for queue ' +
            '(both `renice` and `chrt` have failed), continuing with default priority');
        }
      }
    }));

    N.wire.on('exit.shutdown', { ensure: true, parallel: true }, function shutdown_queue_pool(__, callback) {
      pool.once('exit', callback);
      pool.shutdown();
    });

    N.wire.on('exit.terminate', { ensure: true, parallel: true }, function terminate_queue_pool(__, callback) {
      pool.once('exit', callback);
      pool.terminate();
    });

    N.wire.on('reload', function reload_queue_pool() {
      pool.reload();
    });

    yield new Promise((resolve, reject) => {
      // Wait for either 'online' or 'error' events,
      // whichever comes first
      //
      let on_error, on_online;

      on_online = function () {
        pool.removeListener('online', on_online);
        pool.removeListener('error', on_error);

        resolve();
      };

      on_error = function (error) {
        pool.removeListener('online', on_online);
        pool.removeListener('error', on_error);

        reject(error);
      };

      pool.on('online', on_online);
      pool.on('error',  on_error);
    });

    N.logger.info('Queue workers started successfully');
  });


  N.wire.on('init:services.list', function worker_pool_http_list(data) {
    for (let pool of active_pools) data.push(pool);
  });


  N.wire.on('init:services.qlight', function* qlight_init() {

    var lossy_logger = _.throttle(function (err) {
      N.logger.error(err);
    }, 10000);

    N.queue = new Queue({ redisURL: N.config.database.redis });

    // Log critical errors, here we shouldn't log chunk's errors
    N.queue.on('error', function (err) {
      if (err instanceof Queue.Error || N.redis.connected) {
        // Log all errors if:
        //  1. it's a queue own error
        //  2. redis is connected (probably a command syntax error)
        N.logger.error(err);
      } else {
        // If redis is not connected, this is likely a connection error,
        // so throttle those to avoid logs blowing up.
        lossy_logger(err);
      }
    });

    N.wire.once('exit.shutdown', { ensure: true, parallel: true }, function close_queue() {
      return N.queue.shutdown();
    });

    yield N.wire.emit('init:jobs', N);
    yield N.queue.start();
  });
};
