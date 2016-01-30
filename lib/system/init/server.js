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
const inherits = require('util').inherits;
const StateMachine = require('javascript-state-machine');



////////////////////////////////////////////////////////////////////////////////

function WorkerPool(size, worker) {
  if (!(this instanceof WorkerPool)) return new WorkerPool(size, worker);
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

  get(state) {
    if (!Array.isArray(state)) {
      return this.__workers.filter(w => w.current === state);
    }
    return state.reduce((a, s) => a.concat(this.get(s)), []);
  },

  gc() {
    // Shutdown pending workers when not needed
    let exess = Math.max((this.get('PEND').length + this.get('RUN').length - this.__size), 0);

    this.get('PEND').slice(0, exess).forEach(w => { w.shutdown(); });

    // Drop dead workers
    this.__workers = this.__workers.filter(w => w.current !== 'DEAD');
  },

  update() { wp_update(this); }
};


////////////////////////////////////////////////////////////////////////////////

function Worker(pool) {
  if (!(this instanceof Worker)) return new Worker(pool);
  this.__pool = pool;
  this.__w    = null;
  this.__start_timeout = 0;

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

    w.on('error', err => {
      this.__pool.log.error(err);
      this.die();
    });

    w.on('exit', () => { this.die(); });

    w.on('message', msg => {
      if (!msg || !msg.act) return;
      if (msg.act === 'worker.running') this.run();
    });
  },

  onDEAD() {
    let w = this.__w;
    if (w && !w.isDead()) w.kill();
  }
};

StateMachine.create({
  events: [
    { name: 'begin',     from: 'none',   to: 'INIT'  },
    { name: 'start',     from: 'INIT',   to: 'START' },
    { name: 'run',       from: 'START',  to: 'RUN'   },

    { name: 'freeze',    from: 'RUN',    to: 'PEND'  },
    { name: 'freeze',    from: 'START',  to: 'STOP'  },

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
      yield new Promise(resolve => {
        WorkerPool.prototype.log = N.logger;
        /*eslint-disable new-cap*/
        WorkerPool(fork, WorkerQueue);
        WorkerPool(fork, WorkerHttp);

        // TODO: should wait for `worker.running` from the pools
        cluster.on('listening', () => resolve());
      });
      return;
    }

    // If we are here - need worker deals
    yield N.wire.emit('init:server.worker-http', N);
    yield N.wire.emit('init:server.worker-queue', N);
  });
};
