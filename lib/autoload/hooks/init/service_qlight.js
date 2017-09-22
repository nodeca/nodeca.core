// Expose queue to `N.queue`, register available jobs
//

'use strict';


const execFile   = require('util').promisify(require('child_process').execFile);
const os         = require('os');
const WorkerPool = require('nodeca.core/lib/system/worker_pool');


module.exports = function (N) {

  let active_pools = [];

  N.wire.on('init:services', { parallel: true }, async function worker_pool_queue_init(N) {
    let fork = (N.config.fork || {}).qlight;

    if (fork === 'auto') {
      fork = os.cpus().length;
    } else {
      fork = +fork || 0;
    }

    // single process mode
    if (fork < 1) {
      // Assign all pools to single worker
      N.queue.options({ pool: [ 'default', 'hard' ] });
      // ...and start it
      await N.wire.emit('init:services.qlight', N);
      return;
    }

    let pool = new WorkerPool('qlight', fork);

    active_pools.push(pool);

    pool.on('worker:spawn',  pid         => N.logger.info(`Worker ${pid} spawned`));
    pool.on('worker:error',  error       => N.logger.error(error));
    pool.on('worker:online', pid         => N.logger.info(`Worker ${pid} is running`));
    pool.on('worker:exit',   (pid, code) => N.logger.info(`Worker ${pid} exited with status ${code}`));

    pool.on('worker:online', async function (pid) {
      try {
        // Set scheduling policy to SCHED_IDLE (`-i` flag);
        // `0` is only possible value for priority ('cause this policy doesn't allow to set it)
        await execFile('chrt', [ '-i', '-p', '0', pid ]);
      } catch (__) {
        // If `chrt` not exists, try fallback to `renice`.
        try {
          await execFile('renice', [ '-n', '19', '-p', pid ]);
          N.logger.warn('Cannot set scheduling policy for queue using `chrt`, falling back to `renice`');
        } catch (___) {
          N.logger.error('Cannot lower priority for queue ' +
            '(both `renice` and `chrt` have failed), continuing with default priority');
        }
      }
    });

    N.wire.on('exit.shutdown', { ensure: true, parallel: true }, function shutdown_queue_pool() {
      pool.shutdown();

      return new Promise(resolve => pool.once('exit', resolve));
    });

    N.wire.on('exit.terminate', { ensure: true, parallel: true }, function terminate_queue_pool() {
      pool.terminate();

      return new Promise(resolve => pool.once('exit', resolve));
    });

    N.wire.on('reload', function reload_queue_pool() {
      pool.reload();
    });

    await new Promise((resolve, reject) => {
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


  N.wire.on('init:services.qlight', async function qlight_init() {
    // pool = 'default'
    await N.queue.start();
  });
};
