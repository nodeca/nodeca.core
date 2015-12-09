// Worker class
//
'use strict';


var randomBytes = require('crypto').randomBytes;


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

  this.taskID = options.taskID || function () {
    return randomBytes(20).toString('hex');
  };

  this.chunksPerInstance = options.chunksPerInstance || Infinity;

  this.retry = options.retry || 2;
  this.retryDelay = options.retryDelay || 60000;

  this.timeout = options.timeout || 30000;

  this.cron = options.cron;

  this.postponeDelay = options.postponeDelay;

  this.map = options.map || function (callback) {
    callback(null, [ this.data ]);
  };

  this.process = options.process;

  this.reduce = options.reduce || function (chunksResult, callback) {
    callback();
  };

  this.chunksTracker = {};
}


// Run the task immediately
//
// - taskData (Object) - optional, the task params
// - callback (Function) - called as: `function (err)`
//
Worker.prototype.push = function (taskData, callback) {
  if (!callback) {
    callback = taskData;
    taskData = null;
  }

  this.queue.__addTask__(this, taskData, callback);
};


// Postpone the task executions
//
// - taskData (Object) - optional, the task params, default: `null`
// - delay (Number) - optional, delay execution for the given amount of time, default: `worker.postponeDelay`
// - callback (Function) - called as: `function (err)`
//
Worker.prototype.postpone = function (taskData, delay, callback) {
  var self = this;

  if (arguments.length === 1) {
    // postpone(callback)
    callback = taskData;
    delay = taskData = null;
  } else if (arguments.length === 2) {
    // postpone(delay, callback) if 2nd argument is a number
    // postpone(taskData, callback) otherwise
    callback = delay;

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

  var task_id_local = this.taskID(taskData);
  // Add global prefix and worker name to every task ID
  var task_id_global = self.queue.__prefix__ + this.name + ':' + task_id_local;

  self.queue.__redis__.time(function (err, redisTime) {
    if (err) {
      callback(err);
      return;
    }

    var time = redisToMs(redisTime) + delay;

    // Create a new task in the postponed set
    //
    // - prefix
    // - task ID
    // - worker name
    // - task data
    // - delay
    //
    self.queue.__redis__.eval(
      self.queue.__scripts__.task_add_postponed,
      2,
      self.queue.__prefix__,
      task_id_global,
      self.name,
      JSON.stringify(taskData),
      time,
      function (err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, task_id_local);
      }
    );
  });
};


// Get information about task status.
//
// - taskID (String) - optional, task ID returned from `push` or `postpone`
//   functions, result of `.taskID()` by default
// - callback (Function) - called as `function (err, info)`
//   - info (Object | Null) - task info if task exists, null otherwise
//     - worker (String) - worker name
//     - state  (String) - one of "mapping", "aggregating", "reducing" or "postponed"
//     - chunks (Object) - full chunk IDs by state (optional, only present if task is in "aggregating" state)
//       - pending (Array) - array of pending chunk IDs
//       - active  (Array) - array of active chunk IDs
//       - done    (Array) - array of completed chunk IDs
//       - errored (Array) - array of failed chunk IDs
//
Worker.prototype.status = function (taskID, callback) {
  var self = this;

  if (!callback) {
    callback = taskID;
    taskID = this.taskID();
  }

  var result = {};

  // Add global prefix and worker name to every task ID
  var task_id_global = self.queue.__prefix__ + this.name + ':' + taskID;

  self.queue.__redis__.hmget(task_id_global, 'type', 'state', function (err, data) {
    if (err) {
      callback(err);
      return;
    }

    if (!data[0]) {
      // no such task exists
      callback(null, null);
      return;
    }

    result.worker = data[0];
    result.state  = data[1];

    if (result.state !== 'aggregating') {
      callback(null, result);
      return;
    }

    self.queue.__redis__.multi()
        .lrange(task_id_global + ':chunks:pending', 0, -1)
        .zrange(task_id_global + ':chunks:active', 0, -1)
        .zrange(task_id_global + ':chunks:errored', 0, -1)
        .smembers(task_id_global + ':chunks:done')
        .exec(function (err, data) {

      if (err) {
        callback(err);
        return;
      }

      result.chunks = {
        pending: data[0],
        active:  data[1],
        errored: data[2],
        done:    data[3]
      };

      callback(null, result);
    });
  });
};


// Cancel the task and remove it from queue. Chunks that started execution
// will continue, but their results will be discarded and no new chunks
// will be processed.
//
// - taskID (String) - optional, task ID returned from `push` or `postpone`
//   functions, result of `.taskID()` by default
// - callback (Function) - called as: `function (err)`
//
Worker.prototype.cancel = function (taskID, callback) {
  if (!callback) {
    callback = taskID;
    taskID = this.taskID();
  }

  // Add global prefix and worker name to every task ID
  var task_id_global = this.queue.__prefix__ + this.name + ':' + taskID;

  this.queue.__deleteTask__(task_id_global, callback);
};


module.exports = Worker;
