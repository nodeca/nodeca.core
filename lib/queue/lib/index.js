// Queue class
//
// Redis keys structure (all keys starts with prefix defined in constructor, "queue:" by default):
//
// - workers                 (zset) - registered workers names
// - postponed               (zset) - postponed tasks IDs
// - pending                 (set)  - incoming tasks IDs
// - mapping                 (zset) - tasks with state `mapping`
// - aggregating             (set)  - tasks with state `aggregating`
// - reducing                (zset) - tasks with state `reducing`
// - <taskID>                (hash) - task options (type, retries, state, data)
// - <taskID>:postponed      (hash) - task options for postponed tasks
// - <taskID>:chunks:pending (list) - pending chunks IDs
// - <taskID>:chunks:active  (zset) - active chunks IDs
// - <taskID>:chunks:errored (zset) - errored chunks IDs
// - <taskID>:chunks:done    (set)  - finished chunks IDs
// - <taskID>:<chunkID>      (hash) - chunk's data (retries, data, result)
//
'use strict';


var CronJob      = require('cron').CronJob;
var inherits     = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var path         = require('path');
var fs           = require('fs');
var redis        = require('redis');
var Promise      = require('bluebird');


var Worker       = require('./worker');
var Task         = require('./task');
var Chunk        = require('./chunk');


///////////////////////////////////////////////////////////////////////////////
// Error returned from worker code (from `map`, `reduce` or `process` methods)
//
// - wrappedError (String | Object) - caused error
// - workerName (String) - the worker name
// - taskState (String) - current task state
// - taskID (String) - the task id
// - chunkID (String) - the chunk id, null for `mapping` and `reducing`
// - dataToProcess (Object) - data passed to `map`, `reduce` or `process` method
//
function QueueError(wrappedError, workerName, taskState, taskID, chunkID, dataToProcess) {
  this.name = 'QueueError';
  this.message = wrappedError.toString() +
                 ' (worker: ' + workerName + ', state: ' + taskState + ', task ID: ' + taskID + ')';

  this.wrappedError = wrappedError;
  this.workerName = workerName;
  this.taskState = taskState;
  this.taskID = taskID;
  this.chunkID = chunkID;
  this.dataToProcess = dataToProcess;
}

inherits(QueueError, Error);


// Redis time to milliseconds
//
// - time (Array) - time from redis
//
function redisToMs(time) {
  // Redis reply containing two elements: unix time in seconds, microseconds
  return time[0] * 1000 + Math.round(time[1] / 1000);
}


///////////////////////////////////////////////////////////////////////////////
// Queue constructor
//
// - redis (String) - redis url
// - prefix (String) - optional. Redis keys prefix, "queue:" by default
//
function Queue(redis, prefix) {
  this.__redis__ = null;
  this.__redis_url__ = redis;
  this.__timer__ = null;
  this.__stopped__ = true;
  this.__tick_active__ = false;
  this.__startup_time__ = 0;
  this.__workers__ = {};
  this.__prefix__ = prefix || 'queue:';

  var scripts = {};

  // Load lua scripts
  fs.readdirSync(path.join(__dirname, '../scripts')).forEach(function (fileName) {
    scripts[path.basename(fileName, '.lua')] = fs.readFileSync(path.join(__dirname, '../scripts', fileName), 'utf-8');
  });

  this.__scripts__ = scripts;

  this.__init__();
}


// Global events:
//
// - error
//
inherits(Queue, EventEmitter);


// Register new worker
//
// registerWorker(name [, cron], process):
//
// - name (String) - the worker's name
// - cron (String) - optional, cron string ("15 */6 * * *"), default null
// - process (Function) - called as: `chunk.process(callback)`
//   - this (Object) - current chunk (chunk data is available as `this.data`)
//   - callback (Function) - called as: `function (err, result)`
//
// registerWorker(options):
//
// - options (Object)
//   - name (String) - the worker's name
//   - taskID (Function) - optional, should return new task id. Needed only for
//     creating exclusive tasks, return random value by default, called as: `function (taskData)`
//   - chunksPerInstance (Number) - optional, available count of parallel chunks
//     in one process (Infinity - not restricted), default Infinity
//   - retry (Number) - optional, number of retry on error, default 2
//   - retryDelay (Number) - optional, delay in ms after retries, default 60000 ms
//   - timeout (Number) - optional, `map`, `chunk` and `reduce` execution timeout,
//     default 30000 ms
//   - postponeDelay (Number) - optional, if postpone is called without delay,
//     delay is assumed to be equal to this
//   - cron (String) - optional, cron string ("15 */6 * * *"), default null
//   - track (Boolean) - default 3600000ms (1hr). Time to remember scheduled
//     tasks from cron to avoid rerun if several servers in cluster have wrong
//     clocks. Don't set too high for very frequent tasks, because it can occupy
//     a lot of memory.
//   - map (Function) - optional, proxy taskData to single chunk by default,
//     called as: `task.map(callback)`
//     - this (Object) - current task (task data is available as `this.data`)
//     - callback (Function) - called as: `function (err, chunksData)`
//       - chunksData (Array) - array of chunks data
//   - process (Function) - called as: `chunk.process(callback)`
//     - this (Object) - current chunk (chunk data is available as `this.data`)
//     - callback (Function) - called as: `function (err, result)`
//   - reduce (Function) - optional, only call `callback` by default,
//     called as: `task.reduce(chunksResult, callback)`
//     - this (Object) - current task
//     - chunksResult (Array) - array of chunks results
//     - callback (Function) - called as: `function (err)`
//
// `map`, `chunk` and `reduce` should never return errors in normal case, only in critical exceptions
//
Queue.prototype.registerWorker = function () {
  var options;

  // if `registerWorker(options)`
  if (arguments.length === 1) {
    options = _.clone(arguments[0]);

  // if `registerWorker(name, worker)`
  } else if (arguments.length === 2) {
    options = {
      name: arguments[0],
      process: arguments[1]
    };

  // if `registerWorker(name, cron, worker)`
  } else {
    options = {
      name: arguments[0],
      cron: arguments[1],
      process: arguments[2]
    };
  }

  if (this.__workers__[options.name]) {
    throw new Error('Queue registerWorker error: worker with name "' + options.name + '" already registered.');
  }

  var worker = new Worker(this, options);

  this.__workers__[options.name] = worker;

  if (worker.cron) {
    this.__schedule__(worker);
  }
};


// Get worker by name. Returns `null` if worker not exists.
//
// - workerName (String) - the worker name
//
Queue.prototype.worker = function (workerName) {
  return this.__workers__[workerName] || null;
};


// Start queue processing. Should be called after all workers registration.
//
Queue.prototype.start = function () {
  this.__stopped__ = false;
};


// Stop accepting new tasks from queue. Active tasks continue execution
//
Queue.prototype.shutdown = function () {
  this.__stopped__ = true;
};


// Check if queue is idle;
// clean up worker.chunksTracker as a side-effect
//
Object.defineProperty(Queue.prototype, 'idle', {
  get() {
    var self = this;
    var idle = true;

    Object.keys(self.__workers__).forEach(function (workerName) {
      var worker = self.__workers__[workerName];

      Object.keys(worker.chunksTracker).forEach(function (taskID) {
        if (worker.chunksTracker[taskID] > 0) {
          idle = false;
        } else {
          delete worker.chunksTracker[taskID];
        }
      });
    });

    return idle;
  }
});


///////////////////////////////////////////////////////////////////////////////
// Private methods


// Schedule the task executions
//
// - worker (Object) - worker options
//
Queue.prototype.__schedule__ = function (worker) {
  var self = this;

  var job = new CronJob(worker.cron, function scheduledRun() {
    /* eslint-disable consistent-this */
    var cron = this;

    Promise.coroutine(function* () {
      if (self.__stopped__) return;

      if (!worker.track) {
        try {
          yield self.__addTask__(worker);
        } catch (err) {
          self.emit('error', err);
        }
        return;
      }

      // To generate `sheduledID` we use timestamp of next exec because `node-cron`
      // doesn't present timestamp of current exec
      var scheduledID = [ self.__prefix__, 'cron:', worker.name, ':', cron.cronTime.sendAt().format('X') ].join('');

      // Check if another instance scheduled the task
      let acquired;

      try {
        acquired = yield self.__redis__.setnxAsync(scheduledID, scheduledID);
      } catch (err) {
        self.emit('error', err);
        return;
      }

      // Exit if the task already scheduled in different instance
      if (!acquired) return;

      // Set tracker lifetime (3 days) to auto collect garbage
      try {
        yield self.__redis__.expireAsync(scheduledID, worker.track / 1000);
      } catch (err) {
        self.emit('error', err);
        return;
      }

      try {
        yield self.__addTask__(worker);
      } catch (err) {
        self.emit('error', err);
      }
    })();
  });

  job.start();
};


// Add new task to pending set
//
// - worker (Worker) - the worker instance
// - taskData (Object) - serializable task data, will be passed to `map`
// - callback (Function)
//
Queue.prototype.__addTask__ = Promise.coroutine(function* (worker, taskData) {
  var self = this;

  var task_id_local = worker.taskID(taskData);
  // Add global prefix and worker name to every task ID
  var task_id_global = self.__prefix__ + worker.name + ':' + task_id_local;

  // Check that the task not exists yet and add
  //
  // - prefix
  // - task ID
  // - worker name
  // - task data
  //
  yield self.__redis__.evalAsync(
    self.__scripts__.task_add,
    2,
    self.__prefix__,
    task_id_global,
    worker.name,
    JSON.stringify(taskData || null)
  );

  return task_id_local;
});


// Map task
//
// - task (String) - the task to perform map operation on
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doMap__ = function (task, timestamp) {
  var self = this;

  Promise.coroutine(function* () {
    var worker = task.worker;

    let chunksData;

    // Execute worker's map to get chunks
    try {
      chunksData = yield task.map();
    } catch (err) {
      /* eslint-disable no-catch-shadow */
      // On error we should postpone next map execution
      // Send error event with error, worker name and task ID to have ability group errors
      self.emit('error', new QueueError(err, worker.name, 'mapping', task.id, null, task.data));

      // Get redis current time to set retry timeout
      let time;

      try {
        time = yield self.__redis__.timeAsync();
      } catch (err) {
        // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
        self.emit('error', err);
        return;
      }

      // Postpone next retry with delay. Params:
      //
      // - prefix
      // - task ID
      // - timestamp of next retry
      // - old timestamp to be sure what watchdog did not updated this task in retry attempt
      //
      try {
        yield self.__redis__.evalAsync(
          self.__scripts__.task_mapping_to_mapping,
          2,
          self.__prefix__,
          self.__prefix__ + worker.name + ':' + task.id,
          redisToMs(time) + worker.retryDelay,
          timestamp
        );
      } catch (err) {
        self.emit('error', err);
        return;
      }
      return;
    }

    // Process arguments for `task_mapping_to_aggregating` script

    // Set prefix
    var args = [ self.__prefix__ ];

    // Set chunks IDs
    args = args.concat(chunksData.map(function (__, i) {
      return self.__prefix__ + worker.name + ':' + task.id + ':' + i;
    }));

    // Set `taskID`
    args.push(self.__prefix__ + worker.name + ':' + task.id);

    // Set chunks data
    args = args.concat(chunksData.map(function (chunkData) {
      return JSON.stringify(chunkData);
    }));

    // Set script and arguments length
    args = [
      self.__scripts__.task_mapping_to_aggregating,
      args.length / 2
    ].concat(args);

    // Move task from mapping to aggregating and add chunks
    let moved;

    try {
      moved = yield self.__redis__.evalAsync(args);
    } catch (err) {
      self.emit('error', err);
      return;
    }

    if (!moved) return;

    // On success try do next step immediately to minimize latency
    self.__doAggregate__(self.__prefix__ + worker.name + ':' + task.id);
  })();
};


// Update task's deadline in mapping set and run again suspended or errored `map`
//
// - task_id_global (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryMapping__ = Promise.coroutine(function* (task_id_global, timestamp) {
  var self = this;

  let data;

  // Get redis time and task options
  try {
    data = yield self.__redis__.multi()
                     .time()
                     .hmget(task_id_global, 'data', 'type', 'retries')
                     .exists(task_id_global)
                     .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process finished and deleted task - skip
  if (!data[2]) {
    return;
  }

  var time = data[0];
  var taskData = data[1][0];
  var workerName = data[1][1];
  var taskRetries = data[1][2];

  var worker = self.__workers__[workerName];

  // Check if retry count exceeded
  if (taskRetries > worker.retry) {
    self.__deleteTask__(task_id_global);
    return;
  }

  var deadline = redisToMs(time) + worker.timeout;

  // Update task timeout deadline. Params:
  //
  // - prefix
  // - task ID
  // - timestamp of max task age
  // - old timestamp to be sure what watchdog did not updated this task in retry attempt
  //
  let updated;

  try {
    updated = yield self.__redis__.evalAsync(
      self.__scripts__.task_mapping_to_mapping,
      2,
      self.__prefix__,
      task_id_global,
      deadline,
      timestamp
    );
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process got task - skip
  if (!updated) {
    return;
  }


  var task_id_local = task_id_global.substr((self.__prefix__ + worker.name + ':').length);
  var task = new Task(task_id_local, JSON.parse(taskData), worker, self);

  // Execute map without wait
  self.__doMap__(task, deadline);
});


// Move task from pending to mapping and run `map`
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__consumeTask__ = Promise.coroutine(function* (task_id_global) {
  var self = this;

  // Get redis time and task options
  let data;

  try {
    data = yield self.__redis__.multi()
                     .time()
                     .hmget(task_id_global, 'data', 'type')
                     .exists(task_id_global)
                     .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process finished and deleted task - skip
  if (!data[2]) {
    return;
  }

  var time = data[0];
  var taskData = data[1][0];
  var workerName = data[1][1];

  var worker = self.__workers__[workerName];

  var deadline = redisToMs(time) + worker.timeout;

  // Try move task from pending set to mapping set. Params
  //
  // - prefix
  // - task ID
  // - timestamp of max task age
  //
  let moved;

  try {
    moved = yield self.__redis__.evalAsync(
      self.__scripts__.task_pending_to_mapping,
      2,
      self.__prefix__,
      task_id_global,
      deadline
    );
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process got task - skip
  if (!moved) {
    return;
  }

  var task_id_local = task_id_global.substr((self.__prefix__ + worker.name + ':').length);
  var task = new Task(task_id_local, JSON.parse(taskData), worker, self);

  // Execute map without wait
  self.__doMap__(task, deadline);
});


// Process single chunk
//
// - chunk (Chunk)
// - deadline (Number) - used to avoid races on retrying task by watchdog and
//   calculate terminate timeout
//
Queue.prototype.__doProcess__ = function (chunk, deadline) {
  var self = this;
  var task = chunk.task;
  var worker = task.worker;

  Promise.coroutine(function* () {
    // Get redis time for suspend timer
    let now;

    try {
      now = yield self.__redis__.timeAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var terminateTimeout = deadline - redisToMs(now);

    // This should never happens because deadline is big enough
    if (terminateTimeout <= 0) {
      worker.chunksTracker[task.id]--;
      return;
    }

    // If task should be terminated, 2 things must be done:
    //
    // - update state in redis (done via watchdog monitor)
    // - release "busy" counters in local process (see below)
    //
    // It doesn't matter, which action will be executed first.
    //
    var terminated = false;

    var terminateTimerId = setTimeout(function () {
      worker.chunksTracker[task.id]--;
      terminated = true;
    }, terminateTimeout);


    // Execute worker's chunk to get result
    let result, error;

    try {
      result = yield chunk.process();
    } catch (err) {
      error = err;
    }

    clearTimeout(terminateTimerId);

    // The rest of chunk state is managed by watchdog
    if (terminated) {
      if (error) {
        self.emit('error', new QueueError(error, worker.name, 'aggregating', task.id, chunk.id, chunk.data));
      }

      return;
    }

    // On error we should postpone next chunk execution
    if (error) {
      // Send error event with error, worker name, task ID and chunk ID to have ability group errors
      self.emit('error', new QueueError(error, worker.name, 'aggregating', task.id, chunk.id, chunk.data));

      // Get redis current time to set retry timeout
      let time;

      try {
        time = yield self.__redis__.timeAsync();
      } catch (err) {
        // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
        worker.chunksTracker[task.id]--;
        self.emit('error', err);
        return;
      }

      // Postpone next retry with delay. Params:
      //
      // - task ID
      // - chunk ID
      // - timestamp of next retry
      // - old timestamp to be sure what watchdog did not updated this task in retry attempt
      //
      error = null;

      try {
        yield self.__redis__.evalAsync(
          self.__scripts__.chunk_active_to_errored,
          2,
          self.__prefix__ + worker.name + ':' + task.id,
          chunk.id,
          redisToMs(time) + worker.retryDelay,
          deadline
        );
      } catch (err) {
        error = err;
      }

      worker.chunksTracker[task.id]--;

      if (error) {
        self.emit('error', error);
      }

      return;
    }

    // Move chunk to finished. Params:
    //
    // - task ID
    // - chunk ID
    // - chunk result or null
    //
    let moved;

    try {
      moved = yield self.__redis__.evalAsync(
        self.__scripts__.chunk_active_to_done,
        2,
        self.__prefix__ + worker.name + ':' + task.id,
        chunk.id,
        JSON.stringify(result || null)
      );
    } catch (err) {
      worker.chunksTracker[task.id]--;
      self.emit('error', err);
      return;
    }

    worker.chunksTracker[task.id]--;

    if (moved) {
      // On success try do next step immediately to minimize latency
      self.__doAggregate__(self.__prefix__ + worker.name + ':' + task.id);
    }
  })();
};


// Move chunk from pending to active and execute it
//
// - worker (Object) - the worker options
// - task_id_global (String) - the task ID
//
Queue.prototype.__consumeChunk__ = function (worker, task_id_global) {
  var self = this;

  Promise.coroutine(function* () {
    let time;

    try {
      time = yield self.__redis__.timeAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var deadline = redisToMs(time) + worker.timeout;
    var task_id_local = task_id_global.substr((self.__prefix__ + worker.name + ':').length);

    // If max chunks count exceeded - skip
    if (worker.chunksTracker[task_id_local] >= worker.chunksPerInstance) {
      return;
    }

    // Set initial value for `chunksTracker`
    worker.chunksTracker[task_id_local] = worker.chunksTracker[task_id_local] || 0;

    // Increment tracker before lock
    worker.chunksTracker[task_id_local]++;

    // Try move chunk from pending list to active set and return moved chunk ID
    //
    // - task_id_global
    // - deadline timestamp
    //
    let chunkID;

    try {
      chunkID = yield self.__redis__.evalAsync(self.__scripts__.chunk_pending_to_active, 1, task_id_global, deadline);
    } catch (err) {
      worker.chunksTracker[task_id_local]--;
      self.emit('error', err);
      return;
    }

    // Could not consume chunk - pending queue is empty (another process already grab all chunks)
    if (!chunkID) {
      worker.chunksTracker[task_id_local]--;
      return;
    }

    let data;

    try {
      data = yield self.__redis__.multi()
                       .hmget(chunkID, 'data', 'retries')
                       .exists(chunkID)
                       .execAsync();
    } catch (err) {
      worker.chunksTracker[task_id_local]--;
      self.emit('error', err);
      return;
    }

    // If another process finished and deleted chunk - skip
    if (!data[1]) {
      worker.chunksTracker[task_id_local]--;
      return;
    }

    var chunkData = data[0][0];
    var chunkRetries = data[0][1];

    // Check if retry count exceeded
    if (chunkRetries > worker.retry) {
      worker.chunksTracker[task_id_local]--;
      self.__deleteChunk__(task_id_global, chunkID);
      return;
    }

    var task = new Task(task_id_local, null, worker, self);
    var chunk = new Chunk(chunkID, JSON.parse(chunkData), task);

    self.__doProcess__(chunk, deadline);
  })();
};


// Reduce task
//
// - task (Object) - task to perform reduce on
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doReduce__ = function (task, timestamp) {
  var self = this;
  var worker = task.worker;
  var task_id_global = self.__prefix__ + worker.name + ':' + task.id;

  Promise.coroutine(function* () {
    let chunkIDs;

    try {
      chunkIDs = yield self.__redis__.smembersAsync(task_id_global + ':chunks:done');
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var query = self.__redis__.multi();

    chunkIDs.forEach(function (chunkID) {
      query.hget(chunkID, 'result');
    });

    query.exists(task_id_global);

    let data;

    try {
      data = yield query.execAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var task_exists = data.pop();

    // If another process finished and deleted task - skip
    if (!task_exists) return;

    var chunksResults = data.map(function (chunkDataStr) {
      return JSON.parse(chunkDataStr);
    });

    try {
      yield task.reduce(chunksResults);
    } catch (err) {
      /* eslint-disable no-catch-shadow */
      // On error we should postpone next reduce execution
      // Send error event with error, worker name and task ID to have ability group errors
      self.emit('error', new QueueError(err, worker.name, 'reducing', task.id, null, chunksResults));

      // Get redis current time to set retry timeout
      let time;

      try {
        time = yield self.__redis__.timeAsync();
      } catch (err) {
        // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
        self.emit('error', err);
        return;
      }

      // Postpone next retry with delay. Params:
      //
      // - prefix
      // - task ID
      // - timestamp of next retry
      // - old timestamp to be sure what watchdog did not updated this task in retry attempt
      //
      try {
        yield self.__redis__.evalAsync(
          self.__scripts__.task_reducing_to_reducing,
          2,
          self.__prefix__,
          task_id_global,
          redisToMs(time) + worker.retryDelay,
          timestamp
        );
      } catch (err) {
        self.emit('error', err);
        return;
      }
      return;
    }

    // Delete task when it is finished
    self.__deleteTask__(task_id_global);
  })();
};


// Update task's deadline in reducing set and run again suspended or errored `reduce`
//
// - task_id_global (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryReducing__ = Promise.coroutine(function* (task_id_global, timestamp) {
  var self = this;

  // Get redis time and task options
  let data;

  try {
    data = yield self.__redis__.multi()
                     .hmget(task_id_global, 'type', 'retries')
                     .time()
                     .exists(task_id_global)
                     .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process finished and deleted task - skip
  if (!data[2]) {
    return;
  }

  var workerName = data[0][0];
  var taskRetries = data[0][1];
  var time = data[1];

  var worker = self.__workers__[workerName];

  // Check if retry count exceeded
  if (taskRetries > worker.retry) {
    self.__deleteTask__(task_id_global);
    return;
  }

  var deadline = redisToMs(time) + worker.timeout;

  // Update task deadline. Params:
  //
  // - prefix
  // - task ID
  // - timestamp of max task age
  // - old timestamp to be sure what watchdog did not updated this task in retry attempt
  //
  let updated;

  try {
    updated = yield self.__redis__.evalAsync(
      self.__scripts__.task_reducing_to_reducing,
      2,
      self.__prefix__,
      task_id_global,
      deadline,
      timestamp
    );
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process got task - skip
  if (!updated) {
    return;
  }

  var task_id_local = task_id_global.substr((self.__prefix__ + worker.name + ':').length);
  var task = new Task(task_id_local, null, worker, self);

  // Execute reduce without wait
  self.__doReduce__(task, deadline);
});


// Delete chunk ID from `<task_id_global>:chunks:*` sets and delete `<chunkID>` hash
//
// - task_id_global (String) - the task ID
// - chunkID (String) - the chunk ID
//
Queue.prototype.__deleteChunk__ = function (task_id_global, chunkID) {
  var self = this;

  Promise.coroutine(function* () {
    try {
      yield self.__redis__.multi()
                .lrem(task_id_global + ':chunks:pending', 0, chunkID)
                .zrem(task_id_global + ':chunks:active', chunkID)
                .zrem(task_id_global + ':chunks:errored', chunkID)
                .srem(task_id_global + ':chunks:done', chunkID)
                .del(chunkID)
                .execAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }
  })();
};


// Delete task from all sets and delete all keys associated with task
//
// - task_id_global (String) - the task ID
// - callback (Function) - callback (optional)
//
Queue.prototype.__deleteTask__ = Promise.coroutine(function* (task_id_global) {
  var self = this;

  let result;

  try {
    // Get all chunks IDs
    result = yield self.__redis__.multi()
                       .lrange(task_id_global + ':chunks:pending', 0, -1)
                       .zrange(task_id_global + ':chunks:active', 0, -1)
                       .zrange(task_id_global + ':chunks:errored', 0, -1)
                       .smembers(task_id_global + ':chunks:done')
                       .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // Process all keys associated with task
  var keys = [
    task_id_global,
    task_id_global + ':chunks:pending',
    task_id_global + ':chunks:active',
    task_id_global + ':chunks:errored',
    task_id_global + ':chunks:done'
  ]
    // Chunks IDs from `<task_id_global>:chunks:pending`
    .concat(result[0])
    // Chunks IDs from `<task_id_global>:chunks:active`
    .concat(result[1])
    // Chunks IDs from `<task_id_global>:chunks:errored`
    .concat(result[2])
    // Chunks IDs from `<task_id_global>:chunks:done`
    .concat(result[3]);

  try {
    yield self.__redis__.multi()
              // Remove task from all queue sets
              .srem(self.__prefix__ + 'pending', task_id_global)
              .zrem(self.__prefix__ + 'mapping', task_id_global)
              .srem(self.__prefix__ + 'aggregating', task_id_global)
              .zrem(self.__prefix__ + 'reducing', task_id_global)
              // Remove task keys
              .del(keys)
              .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }
});


// Process chunks or move the task to reducing if chunks done
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__doAggregate__ = Promise.coroutine(function* (task_id_global) {
  var self = this;

  let data;

  try {
    // Get task type, chunks count in pending, active and errored sets and time
    data = yield self.__redis__.multi()
                     .hget(task_id_global, 'type')
                     .llen(task_id_global + ':chunks:pending')
                     .zcard(task_id_global + ':chunks:active')
                     .zcard(task_id_global + ':chunks:errored')
                     .time()
                     .exists(task_id_global)
                     .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If another process finished and deleted task - skip
  if (!data[5]) {
    return;
  }

  var workerName = data[0];
  var pendingChunksCount = data[1];
  var activeChunksCount = data[2];
  var erroredChunksCount = data[3];
  var time = data[4];

  var worker = self.__workers__[workerName];
  var task_id_local = task_id_global.substr((self.__prefix__ + worker.name + ':').length);

  // If all chunks done - change state to reducing
  if (pendingChunksCount === 0 && activeChunksCount === 0 && erroredChunksCount === 0) {
    var deadline = redisToMs(time) + worker.timeout;

    // Move the task from aggregating to reducing and update their state
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    //
    let moved;

    try {
      moved = yield self.__redis__.evalAsync(
        self.__scripts__.task_aggregating_to_reducing,
        2,
        self.__prefix__,
        task_id_global,
        deadline
      );
    } catch (err) {
      self.emit('error', err);
      return;
    }

    // If another process got task - skip
    if (!moved) {
      return;
    }

    var task = new Task(task_id_local, null, worker, self);

    // Don't wait
    self.__doReduce__(task, deadline);

    return;
  }

  // Move errored and suspended chunks back to pending before grab new chunks
  //
  // - task ID
  // - timestamp of max chunks age
  //
  try {
    yield self.__redis__.evalAsync(
      self.__scripts__.chunk_active_and_errored_to_pending,
      1,
      task_id_global,
      redisToMs(time)
    );
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // If max chunks count exceeded - skip
  if (worker.chunksTracker[task_id_local] >= worker.chunksPerInstance) {
    return;
  }

  // Get available pending chunks count
  let countAvailable;

  try {
    countAvailable = yield self.__redis__.llenAsync(task_id_global + ':chunks:pending');
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // Process chunks from pending queue
  //
  // Note: `worker.chunksPerInstance` could be equals infinity
  //
  var cnt = Math.min(worker.chunksPerInstance - (worker.chunksTracker[task_id_local] || 0), countAvailable);

  for (var i = 0; i < cnt; i++) {
    self.__consumeChunk__(worker, task_id_global);
  }
});


// Check is worker registered on this instance without fetch additional data from redis
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__hasKnownWorker__ = function (task_id_global) {
  var workersNames = Object.keys(this.__workers__);

  for (var i = 0; i < workersNames.length; i++) {
    if (task_id_global.indexOf(this.__prefix__ + workersNames[i] + ':') === 0) {
      return true;
    }
  }

  return false;
};


// Change currently running task deadline
//
// - task (Task) - the task instance
// - timeLeft (Number) - amount of time until new deadline
// - callback (Function)
//
Queue.prototype.__setTaskDeadline__ = function (task, timeLeft) {
  var self = this;
  var task_id_global = self.__prefix__ + task.worker.name + ':' + task.id;

  Promise.coroutine(function* () {
    let redisTime;

    try {
      redisTime = yield self.__redis__.timeAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var deadline = redisToMs(redisTime) + timeLeft;

    try {
      yield self.__redis__.multi()
                .zadd(self.__prefix__ + 'mapping', 'XX', deadline, task_id_global)
                .zadd(self.__prefix__ + 'reducing', 'XX', deadline, task_id_global)
                .execAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }
  })();
};


// Change currently running task's chunk deadline
//
// - chunk (Chunk) - the chunk instance
// - timeLeft (Number) - amount of time until new deadline
// - callback (Function)
//
Queue.prototype.__setChunkDeadline__ = function (chunk, timeLeft) {
  var self = this;
  var task_id_global = self.__prefix__ + chunk.task.worker.name + ':' + chunk.task.id;

  Promise.coroutine(function* () {
    let redisTime;

    try {
      redisTime = yield self.__redis__.timeAsync();
    } catch (err) {
      self.emit('error', err);
      return;
    }

    var deadline = redisToMs(redisTime) + timeLeft;

    try {
      yield self.__redis__.zaddAsync(task_id_global + ':chunks:active', 'XX', deadline, chunk.id);
    } catch (err) {
      self.emit('error', err);
      return;
    }
  })();
};


// Remove worker and all its tasks
//
// - workerName (String) - the worker name
//
Queue.prototype.__cleanupWorker__ = Promise.coroutine(function* (workerName) {
  var self = this;

  // Get all taskIDs
  let data;

  try {
    data = yield self.__redis__.multi()
                     .zrange(this.__prefix__ + 'postponed', 0, -1)
                     .smembers(this.__prefix__ + 'pending')
                     .zrange(this.__prefix__ + 'mapping', 0, -1)
                     .smembers(this.__prefix__ + 'aggregating')
                     .zrange(this.__prefix__ + 'reducing', 0, -1)
                     .execAsync();
  } catch (err) {
    self.emit('error', err);
    return;
  }

  var taskIDs = [];

  data.forEach(function (taskList) {
    taskIDs = taskIDs.concat(taskList || []);
  });

  // Filter by worker name
  taskIDs = taskIDs.filter(function (taskID) {
    return _.startsWith(taskID, self.__prefix__ + workerName + ':');
  });

  // Remove tasks
  try {
    yield Promise.map(taskIDs, function (taskID) {
      return self.__deleteTask__(taskID);
    });
  } catch (err) {
    self.emit('error', err);
    return;
  }

  // Remove worker
  try {
    yield self.__redis__.zremAsync(self.__prefix__ + 'workers', workerName);
  } catch (err) {
    self.emit('error', err);
  }
});


// Get and process tasks
//
Queue.prototype.__tick__ = function () {
  var self = this;

  Promise.coroutine(function* () {
    if (self.__stopped__) {
      return;
    }

    // Check previous __tick__ finished
    if (self.__tick_active__) {
      return;
    }

    // Check if the queue is idle
    //
    if (self.idle) self.emit('idle');

    self.__tick_active__ = true;

    let redisTime;

    try {
      redisTime = yield self.__redis__.timeAsync();
    } catch (err) {
      self.emit('error', err);
      self.__tick_active__ = false;
      return;
    }

    var time = redisToMs(redisTime);

    // Init startup time on first tick
    if (self.__startup_time__ === 0) {
      self.__startup_time__ = time;
    }

    yield Promise.all([


      // Monitor postponed tasks
      //
      Promise.coroutine(function* () {
        let taskIDs;

        try {
          taskIDs = yield self.__redis__.zrangebyscoreAsync(self.__prefix__ + 'postponed', '-inf', time);
        } catch (err) {
          return;
        }

        taskIDs = taskIDs.filter(function (taskID) {
          return self.__hasKnownWorker__(taskID);
        });

        var multi = self.__redis__.multi();

        taskIDs.forEach(function (taskID) {
          // Try to move task from postponed set to pending set. If a task with
          // the same ID is already running, do nothing.
          //
          // - prefix
          // - task ID
          //
          multi.eval(
            self.__scripts__.task_postponed_to_pending,
            2,
            self.__prefix__,
            taskID
          );
        });

        try {
          yield multi.execAsync();
        } catch (err) {
          self.emit('error', err);
        }
      })(),


      // Monitor new pending tasks
      //
      Promise.coroutine(function* () {
        let taskIDs;

        try {
          taskIDs = yield self.__redis__.smembersAsync(self.__prefix__ + 'pending');
        } catch (err) {
          return;
        }

        taskIDs = taskIDs.filter(function (taskID) {
          return self.__hasKnownWorker__(taskID);
        });

        yield Promise.map(taskIDs, function (taskID) {
          return self.__consumeTask__(taskID);
        });
      })(),


      // Monitor new task's chunks
      //
      Promise.coroutine(function* () {
        let taskIDs;

        try {
          taskIDs = yield self.__redis__.smembersAsync(self.__prefix__ + 'aggregating');
        } catch (err) {
          return;
        }

        taskIDs = taskIDs.filter(function (taskID) {
          return self.__hasKnownWorker__(taskID);
        });

        yield Promise.map(taskIDs, function (taskID) {
          return self.__doAggregate__(taskID);
        });
      })(),


      // Watchdog suspended and error tasks at mapping state
      //
      Promise.coroutine(function* () {
        // Get tasks IDs and its deadlines
        let result;

        try {
          result = yield self.__redis__.zrangebyscoreAsync(self.__prefix__ + 'mapping', '-inf', time, 'withscores');
        } catch (err) {
          return;
        }

        var items = [];

        for (var i = 0; i < result.length; i += 2) {
          items.push({ taskID: result[i], score: result[i + 1] });
        }

        items = items.filter(function (item) {
          return self.__hasKnownWorker__(item.taskID);
        });

        yield Promise.map(items, function (item) {
          return self.__retryMapping__(item.taskID, item.score);
        });
      })(),


      // Watchdog suspended and error tasks at reducing state
      //
      Promise.coroutine(function* () {
        let result;

        try {
          // Get tasks IDs and its deadlines
          result = yield self.__redis__.zrangebyscoreAsync(self.__prefix__ + 'reducing', '-inf', time, 'withscores');
        } catch (err) {
          return;
        }

        var items = [];

        for (var i = 0; i < result.length; i += 2) {
          items.push({ taskID: result[i], score: result[i + 1] });
        }

        items = items.filter(function (item) {
          return self.__hasKnownWorker__(item.taskID);
        });

        yield Promise.map(items, function (item) {
          return self.__retryReducing__(item.taskID, item.score);
        });
      })(),


      // Update timestamp for all registered workers
      //
      Promise.coroutine(function* () {

        var args = [];

        Object.keys(self.__workers__).forEach(function (workerName) {
          args.push(time);
          args.push(workerName);
        });

        // Skip if no workers
        if (!args.length) {
          return;
        }

        try {
          yield self.__redis__.zaddAsync(self.__prefix__ + 'workers', args);
        } catch (err) {
          self.emit('error', err);
        }
      })(),


      // Delete all tasks for removed workers
      //
      Promise.coroutine(function* () {
        var WORKER_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days

        // Skip garbage collecting if instance recently started
        if (self.__startup_time__ + WORKER_TTL > time) {
          return;
        }

        let workers;

        try {
          workers = yield self.__redis__.zrangebyscoreAsync(self.__prefix__ + 'workers', '-inf', time - WORKER_TTL);
        } catch (err) {
          return;
        }

        yield Promise.map(workers, function (workerName) {
          return self.__cleanupWorker__(workerName);
        });
      })()


    ]);

    self.__tick_active__ = false;
  })();
};


// Init queue
//
Queue.prototype.__init__ = function () {
  var CHECK_INTERVAL = 500;
  var self = this;

  self.__redis__ = redis.createClient(self.__redis_url__, { enable_offline_queue: false });

  self.__redis__.on('error', function (err) {
    self.emit(err);
  });

  self.__redis__.once('ready', function () {
    setTimeout(function () {
      self.__timer__ = setInterval(self.__tick__.bind(self), CHECK_INTERVAL);
    }, Math.round(Math.random() * CHECK_INTERVAL));

    self.emit('connect');

    // TODO: implement pub/sub
  });
};

///////////////////////////////////////////////////////////////////////////////

module.exports = Queue;
module.exports.Error = QueueError;
