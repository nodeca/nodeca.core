// Start server cluster
//
// In cluster mode it forks N http workers + N queue workers.
//
// In single mode it emits `init:server.worker-http` and
// `init:server.worker-queue` events instead
//
'use strict';


const _            = require('lodash');
const cluster      = require('cluster');
const co           = require('co');
const execFile     = require('mz/child_process').execFile;
const os           = require('os');
const inherits     = require('util').inherits;
const EventEmitter = require('events').EventEmitter;
const StateMachine = require('javascript-state-machine');



////////////////////////////////////////////////////////////////////////////////

function WorkerPool(size, worker) {
  if (!(this instanceof WorkerPool)) return new WorkerPool(size, worker);

  EventEmitter.call(this);

  this.__workers = [];
  this.__wClass  = worker;
  this.__size    = 0;

  this.resize(size);
}


const wp_update = _.debounce(function (slf) {
  slf.resize();
  slf.gc();
}, 100, { maxWait: 200 });


WorkerPool.prototype = {
  log() {
    /*eslint-disable no-console*/
    console.log.apply(null, arguments);
  },

  resize(count) {
    // Use current value if no params
    if (!count && count !== 0) {
      count = this.__size;
    }

    let alive = this.get([ 'INIT', 'START', 'RUN' ]),
        delta = count - alive.length,
        prev_size = this.__size;

    this.__size = count;

    if (delta === 0) return;

    if (delta > 0) {
      while (delta--) {
        let w = this.__wClass(this);
        this.__workers.push(w);
        // Force immediate start for the first run
        if (prev_size === 0 && w.can('start')) w.start();
      }
      return;
    }

    alive.slice(0, -delta).forEach(w => { w.shutdown(); });
  },

  terminate() {
    this.__workers.forEach(w => { w.die(); });
  },

  get(state) {
    if (!Array.isArray(state)) {
      return this.__workers.filter(w => w.current === state);
    }
    return state.reduce((a, s) => a.concat(this.get(s)), []);
  },

  gc() {
    // Shutdown pending workers when not needed
    let excess = Math.max((this.get('PEND').length + this.get('RUN').length - this.__size), 0);

    this.get('PEND').slice(0, excess).forEach(w => { w.shutdown(); });

    // Drop dead workers
    this.__workers = this.__workers.filter(w => w.current !== 'DEAD');
  },

  update() { wp_update(this); }
};


Object.setPrototypeOf(WorkerPool.prototype, EventEmitter.prototype);


////////////////////////////////////////////////////////////////////////////////

function Worker(pool) {
  if (!(this instanceof Worker)) return new Worker(pool);
  this.__pool          = pool;
  this.__w             = null;
  this.__start_timeout = 0;
  this.__exit_code     = null;

  this.begin();
}

Worker.prototype = {
  create() {
    throw new Error('This method should be overriden');
  },

  onchangestate() {
    this.__pool.update();
  },

  onINIT() {
    setTimeout(() => {
      if (this.can('start')) this.start();
    }, 2000);
  },

  onSTART() {
    let w = this.__w = this.fork();

    this.__pool.log.info(`Worker ${w.process.pid} spawned`);
    this.__pool.emit('spawn', w.process.pid);

    w.on('error', err => {
      this.__pool.log.error(err);
      this.die();
    });

    w.on('exit', (code, signal) => {
      this.__exit_code = signal || code;
      this.die();
    });

    w.on('message', msg => {
      if (msg === 'worker.running') {
        if (this.can('run')) this.run();
      }
    });
  },

  onSTOP() {
    let w = this.__w;
    process.kill(w.process.pid, 'SIGHUP');
    setTimeout(() => w.die(), 15000);
  },

  onRUN() {
    let w = this.__w;
    this.__pool.log.info(`Worker ${w.process.pid} is running`);
    this.__pool.emit('running', w.process.pid);
  },

  onDEAD() {
    let w = this.__w;

    if (w && !w.isDead()) {
      // use SIGKILL instead of default SIGTERM
      // to guarantee that worker process will stop
      process.kill(w.process.pid, 'SIGKILL');
      w.disconnect();
      this.__exit_code = 'SIGKILL';
    }

    if (w) {
      this.__pool.log.info(`Worker ${w.process.pid} exited with status ${this.__exit_code}`);
      this.__pool.emit('exit', w.process.pid);
    }
  }
};

StateMachine.create({
  events: [
    { name: 'begin',     from: 'none',   to: 'INIT'  },
    { name: 'start',     from: 'INIT',   to: 'START' },
    { name: 'run',       from: 'START',  to: 'RUN'   },

    { name: 'freeze',    from: 'RUN',    to: 'PEND'  },
    { name: 'freeze',    from: 'START',  to: 'DEAD'  },

    { name: 'shutdown',  from: 'RUN',    to: 'STOP'  },
    { name: 'shutdown',  from: 'PEND',   to: 'STOP'  },

    { name: 'die',       from: '*',      to: 'DEAD'  }
  ]
}, Worker.prototype);


////////////////////////////////////////////////////////////////////////////////

function WorkerQueue(pool) {
  if (!(this instanceof WorkerQueue)) return new WorkerQueue(pool);
  Worker.call(this, pool);
}

inherits(WorkerQueue, Worker);

WorkerQueue.prototype.fork = function () {
  cluster.setupMaster({ args: [ 'worker-queue' ] });

  let worker = cluster.fork(),
      log = this.__pool.log;

  worker.on('online', co.wrap(function* () {
    try {
      // Set scheduling policy to SCHED_IDLE (`-i` flag);
      // `0` is only possible value for priority ('cause this policy doesn't allow to set it)
      yield execFile('chrt', [ '-i', '-p', '0', worker.process.pid ]);
    } catch (__) {
      // If `chrt` not exists, try fallback to `renice`.
      try {
        yield execFile('renice', [ '-n', '19', '-p', worker.process.pid ]);
        log.warn('Cannot set scheduling policy for queue using `chrt`, falling back to `renice`');
      } catch (___) {
        log.error('Cannot lower priority for queue ' +
          '(both `renice` and `chrt` have failed), continuing with default priority');
      }
    }
  }));

  return worker;
};

////////////////////////////////////////////////////////////////////////////////

function WorkerHttp(pool) {
  if (!(this instanceof WorkerHttp)) return new WorkerHttp(pool);
  Worker.call(this, pool);
}

inherits(WorkerHttp, Worker);

WorkerHttp.prototype.fork = function () {
  cluster.setupMaster({ args: [ 'worker-http' ] });
  return cluster.fork();
};

////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.on('init:server', function* cluster_init(N) {
    let fork = N.config.fork;

    if (fork === 'auto' || fork === true || _.isUndefined(fork)) {
      fork = os.cpus().length;
    } else {
      fork = +fork || 0;
    }

    if (cluster.isMaster && (fork >= 1)) {
      WorkerPool.prototype.log = N.logger;

      /*eslint-disable new-cap*/
      let pools = [
        WorkerPool(fork, WorkerQueue),
        WorkerPool(fork, WorkerHttp)
      ];

      let shutting_down = false;

      N.wire.on('shutdown', function* shutdown_workers() {
        shutting_down = true;

        yield pools.map(pool => new Promise(resolve => {
          function on_exit() {
            // check workers in every state except DEAD
            if (pool.get([ 'INIT', 'START', 'RUN', 'PEND', 'STOP' ]).length === 0) {
              pool.removeListener('exit', on_exit);
              resolve();
            }
          }

          pool.on('exit', on_exit);
          pool.terminate();
        }));
      });

      yield pools.map(pool => new Promise((resolve, reject) => {
        let on_exit, on_running;

        on_running = function () {
          if (pool.get('RUN').length >= fork) {
            pool.removeListener('running', on_running);
            pool.removeListener('exit', on_exit);
            resolve();
          }
        };

        on_exit = function () {
          pool.removeListener('running', on_running);
          pool.removeListener('exit', on_exit);

          if (shutting_down) {
            reject('Cannot start workers');
          } else {
            // don't throw if user pressed ctrl+c when workers start
            resolve();
          }
        };

        pool.on('running', on_running);
        pool.on('exit', on_exit);
      }));

      N.logger.info('All workers started successfully');
      return;
    }

    // If we are here - need worker deals
    yield N.wire.emit('init:server.worker-http', N);
    yield N.wire.emit('init:server.worker-queue', N);
  });
};
