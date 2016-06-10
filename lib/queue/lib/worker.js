// Worker class
//
'use strict';


const _           = require('lodash');
const co          = require('bluebird-co');
const randomBytes = require('crypto').randomBytes;
const toPromiseFn = require('./utils').toPromiseFn;


// Redis time to milliseconds
//
// - time (Array) - time from redis
//
function redisToMs(time) {
  // Redis reply containing two elements: unix time in seconds, microseconds
  return time[0] * 1000 + Math.round(time[1] / 1000);
}


function Worker(queue, options) {
  this.queue = queue;

  this.name = options.name;

  // Override taskID if passed
  if (options.taskID) {
    if (typeof options.taskID === 'string') {
      this.taskID = function () { return options.taskID; };
    } else {
      this.taskID = options.taskID;
    }
  }

  this.chunksPerInstance = options.chunksPerInstance || Infinity;

  this.retry = options.retry || 2;
  this.retryDelay = options.retryDelay || 60 * 1000;

  this.timeout = options.timeout || 30 * 1000;

  this.cron = options.cron;

  let track = 3600 * 1000;

  if (options.track === false) track = 0;
  if (_.isNumber(options.track)) track = options.track;

  this.track = track;

  this.postponeDelay = options.postponeDelay;

  this.map = toPromiseFn(options.map || function () { return [ this.data ]; }, 0);

  this.process = toPromiseFn(options.process || function () {}, 0);

  this.reduce = toPromiseFn(options.reduce || function (/* chunksResult */) {}, 1);

  this.chunksTracker = {};
}


Worker.prototype.taskID = function () {
  return randomBytes(20).toString('hex');
};


// Run the task immediately
//
// - taskData (Object) - optional, the task params
//
Worker.prototype.push = function (taskData) {
  return this.queue.__addTask__(this, taskData);
};


// Postpone the task executions
//
// - taskData (Object) - optional, the task params, default: `null`
// - delay (Number) - optional, delay execution for the given amount of time,
//   default: `worker.postponeDelay`
//
Worker.prototype.postpone = co.wrap(function* (taskData, delay) {
  if (arguments.length === 1) {
    // postpone(delay) if the argument is a number
    // postpone(taskData) otherwise
    if (Number.isFinite(taskData)) {
      delay = taskData;
      taskData = null;
    } else {
      delay = null;
    }
  }

  if (!Number.isFinite(delay)) {
    delay = this.postponeDelay;
  }

  let task_id_local = this.taskID(taskData);
  // Add global prefix and worker name to every task ID
  let task_id_global = this.queue.__prefix__ + this.name + ':' + task_id_local;

  let redisTime = yield this.queue.__redis__.timeAsync();

  let time = redisToMs(redisTime) + delay;

  // Create a new task in the postponed set
  //
  // - prefix
  // - task ID
  // - worker name
  // - task data
  // - delay
  //
  yield this.queue.__redis__.evalAsync(
    this.queue.__scripts__.task_add_postponed,
    2,
    this.queue.__prefix__,
    task_id_global,
    this.name,
    JSON.stringify(taskData || null),
    time
  );

  return task_id_local;
});


// Get information about task status.
//
// - taskID (String) - optional, task ID returned from `push` or `postpone`
//   functions, result of `.taskID()` by default
//
// The value of the resolved promise is (Object | Null) - task info if task exists, null otherwise
//   - worker (String) - worker name
//   - state  (String) - one of "mapping", "aggregating", "reducing" or "postponed"
//   - chunks (Object) - full chunk IDs by state (optional, only present if task is in "aggregating" state)
//     - pending (Array) - array of pending chunk IDs
//     - active  (Array) - array of active chunk IDs
//     - done    (Array) - array of completed chunk IDs
//     - errored (Array) - array of failed chunk IDs
//
Worker.prototype.status = co.wrap(function* (taskID) {
  let result = {};

  // Add global prefix and worker name to every task ID
  let task_id_global = this.queue.__prefix__ + this.name + ':' + taskID;

  let data = yield this.queue.__redis__.hmgetAsync(task_id_global, 'type', 'state');

  if (!data[0]) {
    // no such task
    return null;
  }

  result.worker = data[0];
  result.state  = data[1];

  if (result.state !== 'aggregating') {
    return result;
  }

  let stats = yield this.queue.__redis__.multi()
                              .llen(task_id_global + ':chunks:pending')
                              .zcard(task_id_global + ':chunks:active')
                              .zcard(task_id_global + ':chunks:errored')
                              .scard(task_id_global + ':chunks:done')
                              .execAsync();

  result.chunks = {
    pending: stats[0],
    active:  stats[1],
    errored: stats[2],
    done:    stats[3]
  };

  return result;
});


// Cancel the task and remove it from queue. Chunks that started execution
// will continue, but their results will be discarded and no new chunks
// will be processed.
//
// - taskID (String) - optional, task ID returned from `push` or `postpone`
//   functions, result of `.taskID()` by default
//
Worker.prototype.cancel = function (taskID) {
  // Add global prefix and worker name to every task ID
  let task_id_global = this.queue.__prefix__ + this.name + ':' + taskID;

  return this.queue.__deleteTask__(task_id_global);
};


module.exports = Worker;
