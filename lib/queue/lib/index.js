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


const _            = require('lodash');
const co           = require('bluebird-co');
const CronJob      = require('cron').CronJob;
const EventEmitter = require('events').EventEmitter;
const fs           = require('fs');
const path         = require('path');
const redis        = require('redis');
const inherits     = require('util').inherits;


const Worker       = require('./worker');
const Task         = require('./task');
const Chunk        = require('./chunk');


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

  let scripts = {};

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
// - process (Function) - called as: `chunk.process()`
//   - this (Object) - current chunk (chunk data is available as `this.data`)
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
//     called as: `task.map()`
//     - this (Object) - current task (task data is available as `this.data`)
//   - process (Function) - called as: `chunk.process()`
//     - this (Object) - current chunk (chunk data is available as `this.data`)
//   - reduce (Function) - optional, only call `callback` by default,
//     called as: `task.reduce(chunkResults)`
//     - this (Object) - current task
//     - chunkResults (Array) - array of chunk results
//
// `map`, `chunk` and `reduce` should never return errors in normal case, only in critical exceptions
//
Queue.prototype.registerWorker = function () {
  let options;

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

  let worker = new Worker(this, options);

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
    let self = this;
    let idle = true;

    Object.keys(self.__workers__).forEach(function (workerName) {
      let worker = self.__workers__[workerName];

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
  let self = this;

  let job = new CronJob(worker.cron, co.wrap(function* scheduledRun() {
    try {
      if (self.__stopped__) return;

      if (!worker.track) {
        self.__addTask__(worker);
        return;
      }

      // To generate `sheduledID` we use timestamp of next exec because `node-cron`
      // doesn't present timestamp of current exec
      let scheduledID = [ self.__prefix__, 'cron:', worker.name, ':', this.cronTime.sendAt().format('X') ].join('');

      // Check if another instance scheduled the task
      let acquired = yield self.__redis__.setnxAsync(scheduledID, scheduledID);

      // Exit if the task already scheduled in different instance
      if (!acquired) return;

      // Set tracker lifetime (3 days) to auto collect garbage
      yield self.__redis__.expireAsync(scheduledID, worker.track / 1000);

      yield self.__addTask__(worker);

    } catch (err) {
      self.emit('error', err);
    }
  }));

  job.start();
};


// Add new task to pending set
//
// - worker (Worker) - the worker instance
// - taskData (Object) - serializable task data, will be passed to `map`
//
Queue.prototype.__addTask__ = co.wrap(function* (worker, taskData) {
  let task_id_local = worker.taskID(taskData);
  // Add global prefix and worker name to every task ID
  let task_id_global = this.__prefix__ + worker.name + ':' + task_id_local;

  // Check that the task not exists yet and add
  //
  // - prefix
  // - task ID
  // - worker name
  // - task data
  //
  yield this.__redis__.evalAsync(
    this.__scripts__.task_add,
    2,
    this.__prefix__,
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
Queue.prototype.__doMap__ = co.wrap(function* (task, timestamp) {
  try {
    let worker = task.worker;
    let chunksData;

    try {
      // Execute worker's map to get chunks
      chunksData = yield task.map();
    } catch (err) {
      // On error we should postpone next map execution
      // Send error event with error, worker name and task ID to have ability group errors
      this.emit('error', new QueueError(err, worker.name, 'mapping', task.id, null, task.data));

      // Get redis current time to set retry timeout
      let time = yield this.__redis__.timeAsync();

      // Postpone next retry with delay. Params:
      //
      // - prefix
      // - task ID
      // - timestamp of next retry
      // - old timestamp to be sure what watchdog did not updated this task in retry attempt
      //
      yield this.__redis__.evalAsync(
        this.__scripts__.task_mapping_to_mapping,
        2,
        this.__prefix__,
        this.__prefix__ + worker.name + ':' + task.id,
        redisToMs(time) + worker.retryDelay,
        timestamp
      );

      return;
    }

    // Process arguments for `task_mapping_to_aggregating` script

    // Set prefix
    let args = [ this.__prefix__ ];

    // Set chunks IDs
    args = args.concat(chunksData.map((__, i) =>
      this.__prefix__ + worker.name + ':' + task.id + ':' + i
    ));

    // Set `taskID`
    args.push(this.__prefix__ + worker.name + ':' + task.id);

    // Set chunks data
    args = args.concat(chunksData.map(chunkData => JSON.stringify(chunkData || null)));

    // Set script and arguments length
    args = [
      this.__scripts__.task_mapping_to_aggregating,
      args.length / 2
    ].concat(args);

    // Move task from mapping to aggregating and add chunks
    let moved = yield this.__redis__.evalAsync(args);

    if (!moved) return;

    // On success try do next step immediately to minimize latency
    this.__doAggregate__(this.__prefix__ + worker.name + ':' + task.id);

  } catch (err) {
    // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
    this.emit('error', err);
  }
});


// Update task's deadline in mapping set and run again suspended or errored `map`
//
// - task_id_global (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryMapping__ = co.wrap(function* (task_id_global, timestamp) {
  try {
    // Get redis time and task options
    let data = yield this.__redis__.multi()
                         .time()
                         .hmget(task_id_global, 'data', 'type', 'retries')
                         .exists(task_id_global)
                         .execAsync();

    // If another process finished and deleted task - skip
    if (!data[2]) return;

    let time = data[0];
    let taskData = data[1][0];
    let workerName = data[1][1];
    let taskRetries = data[1][2];

    let worker = this.__workers__[workerName];

    // Check if retry count exceeded
    if (taskRetries > worker.retry) {
      this.__deleteTask__(task_id_global);
      return;
    }

    let deadline = redisToMs(time) + worker.timeout;

    // Update task timeout deadline. Params:
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    // - old timestamp to be sure what watchdog did not updated this task in retry attempt
    //
    let updated = yield this.__redis__.evalAsync(
      this.__scripts__.task_mapping_to_mapping,
      2,
      this.__prefix__,
      task_id_global,
      deadline,
      timestamp
    );

    // If another process got task - skip
    if (!updated) return;

    let task_id_local = task_id_global.substr((this.__prefix__ + worker.name + ':').length);
    let task = new Task(task_id_local, JSON.parse(taskData), worker, this);

    // Execute map without wait
    this.__doMap__(task, deadline);

  } catch (err) {
    this.emit('error', err);
  }
});


// Move task from pending to mapping and run `map`
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__consumeTask__ = co.wrap(function* (task_id_global) {
  try {
    // Get redis time and task options
    let data = yield this.__redis__.multi()
                         .time()
                         .hmget(task_id_global, 'data', 'type')
                         .exists(task_id_global)
                         .execAsync();

    // If another process finished and deleted task - skip
    if (!data[2]) return;

    let time = data[0];
    let taskData = data[1][0];
    let workerName = data[1][1];

    let worker = this.__workers__[workerName];

    let deadline = redisToMs(time) + worker.timeout;

    // Try move task from pending set to mapping set. Params
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    //
    let moved = yield this.__redis__.evalAsync(
      this.__scripts__.task_pending_to_mapping,
      2,
      this.__prefix__,
      task_id_global,
      deadline
    );

    // If another process got task - skip
    if (!moved) return;

    let task_id_local = task_id_global.substr((this.__prefix__ + worker.name + ':').length);
    let task = new Task(task_id_local, JSON.parse(taskData), worker, this);

    // Execute map without wait
    this.__doMap__(task, deadline);

  } catch (err) {
    this.emit('error', err);
  }
});


// Process single chunk
//
// - chunk (Chunk)
// - deadline (Number) - used to avoid races on retrying task by watchdog and
//   calculate terminate timeout
//
Queue.prototype.__doProcess__ = co.wrap(function* (chunk, deadline) {
  try {
    let task = chunk.task;
    let worker = task.worker;

    // Get redis time for suspend timer
    let now = yield this.__redis__.timeAsync();

    let terminateTimeout = deadline - redisToMs(now);
    let terminateTimerId;

    // This should never happen because deadline is big enough
    if (terminateTimeout <= 0) return;

    let success = false;

    worker.chunksTracker[task.id]++;

    try {
      // If task should be terminated, 2 things must be done:
      //
      // - update state in redis (done via watchdog monitor)
      // - release "busy" counters in local process (see below)
      //
      // It doesn't matter which action will be executed first.
      //
      let terminated = false;

      terminateTimerId = setTimeout(() => {
        worker.chunksTracker[task.id]--;
        terminated = true;
      }, terminateTimeout);


      // Execute worker's chunk to get result
      let result;

      try {
        result = yield chunk.process();

      } catch (err) {
        // Send error event with error, worker name, task ID and chunk ID to have ability group errors
        this.emit('error', new QueueError(err, worker.name, 'aggregating', task.id, chunk.id, chunk.data));

        // On error we should postpone next chunk execution

        // Get redis current time to set retry timeout
        let time = yield this.__redis__.timeAsync();

        // Postpone next retry with delay. Params:
        //
        // - task ID
        // - chunk ID
        // - timestamp of next retry
        // - old timestamp to be sure what watchdog did not updated this task in retry attempt
        //
        yield this.__redis__.evalAsync(
          this.__scripts__.chunk_active_to_errored,
          2,
          this.__prefix__ + worker.name + ':' + task.id,
          chunk.id,
          redisToMs(time) + worker.retryDelay,
          deadline
        );
      }

      // The rest of chunk state is managed by watchdog
      if (terminated) return;

      // Move chunk to finished. Params:
      //
      // - task ID
      // - chunk ID
      // - chunk result or null
      //
      success = yield this.__redis__.evalAsync(
        this.__scripts__.chunk_active_to_done,
        2,
        this.__prefix__ + worker.name + ':' + task.id,
        chunk.id,
        JSON.stringify(result || null)
      );
    } finally {
      worker.chunksTracker[task.id]--;
      clearTimeout(terminateTimerId);
    }

    if (success) {
      // On success try do next step immediately to minimize latency
      this.__doAggregate__(this.__prefix__ + worker.name + ':' + task.id);
    }
  } catch (err) {
    this.emit('error', err);
  }
});


// Move chunk from pending to active and execute it
//
// - worker (Object) - the worker options
// - task_id_global (String) - the task ID
//
Queue.prototype.__consumeChunk__ = co.wrap(function* (worker, task_id_global) {
  try {
    let time = yield this.__redis__.timeAsync();

    let deadline = redisToMs(time) + worker.timeout;
    let task_id_local = task_id_global.substr((this.__prefix__ + worker.name + ':').length);

    // If max chunks count exceeded - skip
    if (worker.chunksTracker[task_id_local] >= worker.chunksPerInstance) {
      return;
    }

    // Set initial value for `chunksTracker`
    worker.chunksTracker[task_id_local] = worker.chunksTracker[task_id_local] || 0;

    // Increment tracker before lock
    worker.chunksTracker[task_id_local]++;

    let chunkID, chunkData;

    // Try move chunk from pending list to active set and return moved chunk ID
    //
    // - task_id_global
    // - deadline timestamp
    //
    try {
      chunkID = yield this.__redis__.evalAsync(
        this.__scripts__.chunk_pending_to_active,
        1,
        task_id_global,
        deadline
      );

      // Could not consume chunk - pending queue is empty (another process already grab all chunks)
      if (!chunkID) return;

      let data = yield this.__redis__.multi()
                           .hmget(chunkID, 'data', 'retries')
                           .exists(chunkID)
                           .execAsync();

      // If another process finished and deleted chunk - skip
      if (!data[1]) return;

      chunkData = data[0][0];

      let chunkRetries = data[0][1];

      // Check if retry count exceeded
      if (chunkRetries > worker.retry) {
        this.__deleteChunk__(task_id_global, chunkID);
        return;
      }
    } finally {
      worker.chunksTracker[task_id_local]--;
    }

    let task = new Task(task_id_local, null, worker, this);
    let chunk = new Chunk(chunkID, JSON.parse(chunkData), task);

    this.__doProcess__(chunk, deadline);

  } catch (err) {
    this.emit('error', err);
  }
});


// Reduce task
//
// - task (Object) - task to perform reduce on
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doReduce__ = co.wrap(function* (task, timestamp) {
  try {
    let worker = task.worker;
    let task_id_global = this.__prefix__ + worker.name + ':' + task.id;

    let chunkIDs = yield this.__redis__.smembersAsync(task_id_global + ':chunks:done');

    let query = this.__redis__.multi();

    chunkIDs.forEach(chunkID => query.hget(chunkID, 'result'));

    query.exists(task_id_global);

    let data = yield query.execAsync();

    let task_exists = data.pop();

    // If another process finished and deleted task - skip
    if (!task_exists) return;

    let chunkResults = data.map(chunkDataStr => JSON.parse(chunkDataStr));

    try {
      yield task.reduce(chunkResults);
    } catch (err) {
      // On error we should postpone next reduce execution
      // Send error event with error, worker name and task ID to have ability group errors
      this.emit('error', new QueueError(err, worker.name, 'reducing', task.id, null, chunkResults));

      // Get redis current time to set retry timeout
      let time = yield this.__redis__.timeAsync();

      // Postpone next retry with delay. Params:
      //
      // - prefix
      // - task ID
      // - timestamp of next retry
      // - old timestamp to be sure what watchdog did not updated this task in retry attempt
      //
      yield this.__redis__.evalAsync(
        this.__scripts__.task_reducing_to_reducing,
        2,
        this.__prefix__,
        task_id_global,
        redisToMs(time) + worker.retryDelay,
        timestamp
      );

      return;
    }

    // Delete task when it is finished
    this.__deleteTask__(task_id_global);

  } catch (err) {
    this.emit('error', err);
  }
});


// Update task's deadline in reducing set and run again suspended or errored `reduce`
//
// - task_id_global (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryReducing__ = co.wrap(function* (task_id_global, timestamp) {
  try {
    // Get redis time and task options
    let data = yield this.__redis__.multi()
                         .hmget(task_id_global, 'type', 'retries')
                         .time()
                         .exists(task_id_global)
                         .execAsync();

    // If another process finished and deleted task - skip
    if (!data[2]) return;

    let workerName = data[0][0];
    let taskRetries = data[0][1];
    let time = data[1];

    let worker = this.__workers__[workerName];

    // Check if retry count exceeded
    if (taskRetries > worker.retry) {
      this.__deleteTask__(task_id_global);
      return;
    }

    let deadline = redisToMs(time) + worker.timeout;

    // Update task deadline. Params:
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    // - old timestamp to be sure what watchdog did not updated this task in retry attempt
    //
    let updated = yield this.__redis__.evalAsync(
      this.__scripts__.task_reducing_to_reducing,
      2,
      this.__prefix__,
      task_id_global,
      deadline,
      timestamp
    );

    // If another process got task - skip
    if (!updated) return;

    let task_id_local = task_id_global.substr((this.__prefix__ + worker.name + ':').length);
    let task = new Task(task_id_local, null, worker, this);

    // Execute reduce without wait
    this.__doReduce__(task, deadline);

  } catch (err) {
    this.emit('error', err);
  }
});


// Delete chunk ID from `<task_id_global>:chunks:*` sets and delete `<chunkID>` hash
//
// - task_id_global (String) - the task ID
// - chunkID (String) - the chunk ID
//
Queue.prototype.__deleteChunk__ = co.wrap(function* (task_id_global, chunkID) {
  try {
    yield this.__redis__.multi()
              .lrem(task_id_global + ':chunks:pending', 0, chunkID)
              .zrem(task_id_global + ':chunks:active', chunkID)
              .zrem(task_id_global + ':chunks:errored', chunkID)
              .srem(task_id_global + ':chunks:done', chunkID)
              .del(chunkID)
              .execAsync();
  } catch (err) {
    this.emit('error', err);
  }
});


// Delete task from all sets and delete all keys associated with task
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__deleteTask__ = co.wrap(function* (task_id_global) {
  try {
    // Get all chunks IDs
    let result = yield this.__redis__.multi()
                           .lrange(task_id_global + ':chunks:pending', 0, -1)
                           .zrange(task_id_global + ':chunks:active', 0, -1)
                           .zrange(task_id_global + ':chunks:errored', 0, -1)
                           .smembers(task_id_global + ':chunks:done')
                           .execAsync();

    // Process all keys associated with task
    let keys = [
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

    yield this.__redis__.multi()
              // Remove task from all queue sets
              .srem(this.__prefix__ + 'pending', task_id_global)
              .zrem(this.__prefix__ + 'mapping', task_id_global)
              .srem(this.__prefix__ + 'aggregating', task_id_global)
              .zrem(this.__prefix__ + 'reducing', task_id_global)
              // Remove task keys
              .del(keys)
              .execAsync();

  } catch (err) {
    this.emit('error', err);
  }
});


// Process chunks or move the task to reducing if chunks done
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__doAggregate__ = co.wrap(function* (task_id_global) {
  try {
    // Get task type, chunks count in pending, active and errored sets and time
    let data = yield this.__redis__.multi()
                         .hget(task_id_global, 'type')
                         .llen(task_id_global + ':chunks:pending')
                         .zcard(task_id_global + ':chunks:active')
                         .zcard(task_id_global + ':chunks:errored')
                         .time()
                         .exists(task_id_global)
                         .execAsync();

    // If another process finished and deleted task - skip
    if (!data[5]) return;

    let workerName = data[0];
    let pendingChunksCount = data[1];
    let activeChunksCount = data[2];
    let erroredChunksCount = data[3];
    let time = data[4];

    let worker = this.__workers__[workerName];
    let task_id_local = task_id_global.substr((this.__prefix__ + worker.name + ':').length);

    // If all chunks done - change state to reducing
    if (pendingChunksCount === 0 && activeChunksCount === 0 && erroredChunksCount === 0) {
      let deadline = redisToMs(time) + worker.timeout;

      // Move the task from aggregating to reducing and update their state
      //
      // - prefix
      // - task ID
      // - timestamp of max task age
      //
      let moved = yield this.__redis__.evalAsync(
        this.__scripts__.task_aggregating_to_reducing,
        2,
        this.__prefix__,
        task_id_global,
        deadline
      );

      // If another process got task - skip
      if (!moved) return;

      let task = new Task(task_id_local, null, worker, this);

      // Don't wait
      this.__doReduce__(task, deadline);

      return;
    }

    // Move errored and suspended chunks back to pending before grab new chunks
    //
    // - task ID
    // - timestamp of max chunks age
    //
    yield this.__redis__.evalAsync(
      this.__scripts__.chunk_active_and_errored_to_pending,
      1,
      task_id_global,
      redisToMs(time)
    );

    // If max chunks count exceeded - skip
    if (worker.chunksTracker[task_id_local] >= worker.chunksPerInstance) {
      return;
    }

    // Get available pending chunks count
    let countAvailable = yield this.__redis__.llenAsync(task_id_global + ':chunks:pending');

    // Process chunks from pending queue
    //
    // Note: `worker.chunksPerInstance` could be equals infinity
    //
    let cnt = Math.min(worker.chunksPerInstance - (worker.chunksTracker[task_id_local] || 0), countAvailable);

    for (let i = 0; i < cnt; i++) {
      this.__consumeChunk__(worker, task_id_global);
    }
  } catch (err) {
    this.emit('error', err);
  }
});


// Check is worker registered on this instance without fetch additional data from redis
//
// - task_id_global (String) - the task ID
//
Queue.prototype.__hasKnownWorker__ = function (task_id_global) {
  let workersNames = Object.keys(this.__workers__);

  for (let i = 0; i < workersNames.length; i++) {
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
//
Queue.prototype.__setTaskDeadline__ = co.wrap(function* (task, timeLeft) {
  try {
    let task_id_global = this.__prefix__ + task.worker.name + ':' + task.id;

    let redisTime = yield this.__redis__.timeAsync();

    let deadline = redisToMs(redisTime) + timeLeft;

    yield this.__redis__.multi()
              .zadd(this.__prefix__ + 'mapping', 'XX', deadline, task_id_global)
              .zadd(this.__prefix__ + 'reducing', 'XX', deadline, task_id_global)
              .execAsync();
  } catch (err) {
    this.emit('error', err);
  }
});


// Change currently running task's chunk deadline
//
// - chunk (Chunk) - the chunk instance
// - timeLeft (Number) - amount of time until new deadline
//
Queue.prototype.__setChunkDeadline__ = co.wrap(function* (chunk, timeLeft) {
  try {
    let task_id_global = this.__prefix__ + chunk.task.worker.name + ':' + chunk.task.id;

    let redisTime = yield this.__redis__.timeAsync();

    let deadline = redisToMs(redisTime) + timeLeft;

    yield this.__redis__.zaddAsync(task_id_global + ':chunks:active', 'XX', deadline, chunk.id);
  } catch (err) {
    this.emit('error', err);
  }
});


// Remove worker and all its tasks
//
// - workerName (String) - the worker name
//
Queue.prototype.__cleanupWorker__ = co.wrap(function* (workerName) {
  try {
    // Get all taskIDs
    let data = yield this.__redis__.multi()
                         .zrange(this.__prefix__ + 'postponed', 0, -1)
                         .smembers(this.__prefix__ + 'pending')
                         .zrange(this.__prefix__ + 'mapping', 0, -1)
                         .smembers(this.__prefix__ + 'aggregating')
                         .zrange(this.__prefix__ + 'reducing', 0, -1)
                         .execAsync();

    let taskIDs = [];

    data.forEach(taskList => {
      taskIDs = taskIDs.concat(taskList || []);
    });

    // Filter by worker name
    taskIDs = taskIDs.filter(taskID => _.startsWith(taskID, this.__prefix__ + workerName + ':'));

    // Remove tasks
    yield Promise.all(taskIDs.map(taskID => this.__deleteTask__(taskID)));

    // Remove worker
    yield this.__redis__.zremAsync(this.__prefix__ + 'workers', workerName);

  } catch (err) {
    this.emit('error', err);
  }
});


// Monitor postponed tasks
//
Queue.prototype.__tickCheckPostponed__ = co.wrap(function* (time) {
  let taskIDs;

  try {
    taskIDs = yield this.__redis__.zrangebyscoreAsync(this.__prefix__ + 'postponed', '-inf', time);
  } catch (__) {
    return;
  }

  try {
    taskIDs = taskIDs.filter(taskID => this.__hasKnownWorker__(taskID));

    let multi = this.__redis__.multi();

    taskIDs.forEach(taskID => {
      // Try to move task from postponed set to pending set. If a task with
      // the same ID is already running, do nothing.
      //
      // - prefix
      // - task ID
      //
      multi.eval(
        this.__scripts__.task_postponed_to_pending,
        2,
        this.__prefix__,
        taskID
      );
    });

    yield multi.execAsync();

  } catch (err) {
    this.emit('error', err);
  }
});


// Monitor new pending tasks
//
Queue.prototype.__tickCheckPending__ = co.wrap(function* (/* time */) {
  let taskIDs;

  try {
    taskIDs = yield this.__redis__.smembersAsync(this.__prefix__ + 'pending');
  } catch (__) {
    return;
  }

  taskIDs = taskIDs.filter(taskID => this.__hasKnownWorker__(taskID));

  yield Promise.all(taskIDs.map(taskID => this.__consumeTask__(taskID)));
});


// Monitor new task's chunks
//
Queue.prototype.__tickAggregate__ = co.wrap(function* (/* time */) {
  let taskIDs;

  try {
    taskIDs = yield this.__redis__.smembersAsync(this.__prefix__ + 'aggregating');
  } catch (__) {
    return;
  }

  taskIDs = taskIDs.filter(taskID => this.__hasKnownWorker__(taskID));

  return Promise.all(taskIDs.map(taskID => this.__doAggregate__(taskID)));
});


// Watchdog suspended and error tasks at mapping state
//
Queue.prototype.__tickRetryMapping__ = co.wrap(function* (time) {
  let result;

  try {
    // Get tasks IDs and its deadlines
    result = yield this.__redis__.zrangebyscoreAsync(this.__prefix__ + 'mapping', '-inf', time, 'withscores');
  } catch (__) {
    return;
  }

  let items = [];

  for (let i = 0; i < result.length; i += 2) {
    items.push({ taskID: result[i], score: result[i + 1] });
  }

  items = items.filter(item => this.__hasKnownWorker__(item.taskID));

  yield Promise.all(items.map(item => this.__retryMapping__(item.taskID, item.score)));
});


// Watchdog suspended and error tasks at reducing state
//
Queue.prototype.__tickRetryReducing__ = co.wrap(function* (time) {
  // Get tasks IDs and its deadlines
  let result;

  try {
    result = yield this.__redis__.zrangebyscoreAsync(this.__prefix__ + 'reducing', '-inf', time, 'withscores');
  } catch (__) {
    return;
  }

  let items = [];

  for (let i = 0; i < result.length; i += 2) {
    items.push({ taskID: result[i], score: result[i + 1] });
  }

  items = items.filter(item => this.__hasKnownWorker__(item.taskID));

  yield Promise.all(items.map(item => this.__retryReducing__(item.taskID, item.score)));
});


// Update timestamp for all registered workers
//
Queue.prototype.__tickUpdateTimestamp__ = co.wrap(function* (time) {
  try {
    let args = [];

    Object.keys(this.__workers__).forEach(workerName => {
      args.push(time);
      args.push(workerName);
    });

    // Skip if no workers
    if (!args.length) return;

    yield this.__redis__.zaddAsync(this.__prefix__ + 'workers', args);

  } catch (err) {
    this.emit('error', err);
  }
});


// Delete all tasks for removed workers
//
Queue.prototype.__tickCleanupWorker__ = co.wrap(function* (time) {
  const WORKER_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days

  // Skip garbage collecting if instance recently started
  if (this.__startup_time__ + WORKER_TTL > time) return;

  let workers;

  try {
    workers = yield this.__redis__.zrangebyscoreAsync(this.__prefix__ + 'workers', '-inf', time - WORKER_TTL);
  } catch (__) {
    return;
  }

  yield workers.map(workerName => this.__cleanupWorker__(workerName));
});


// Get and process tasks
//
Queue.prototype.__tick__ = co.wrap(function* () {
  if (this.__stopped__) return;

  // Check previous __tick__ finished
  if (this.__tick_active__) return;

  // Check if the queue is idle
  //
  if (this.idle) this.emit('idle');

  this.__tick_active__ = true;

  try {
    let redisTime = yield this.__redis__.timeAsync();

    let time = redisToMs(redisTime);

    // Init startup time on first tick
    if (this.__startup_time__ === 0) {
      this.__startup_time__ = time;
    }

    yield Promise.all([
      this.__tickCheckPostponed__(time),
      this.__tickCheckPending__(time),
      this.__tickAggregate__(time),
      this.__tickRetryMapping__(time),
      this.__tickRetryReducing__(time),
      this.__tickUpdateTimestamp__(time),
      this.__tickCleanupWorker__(time)
    ]);

  } catch (err) {
    this.emit('error', err);

  } finally {
    this.__tick_active__ = false;
  }
});


// Init queue
//
Queue.prototype.__init__ = function () {
  const CHECK_INTERVAL = 500;

  this.__redis__ = redis.createClient(this.__redis_url__, { enable_offline_queue: false });

  this.__redis__.on('error', err => { this.emit(err); });

  this.__redis__.once('ready', () => {
    setTimeout(() => {
      this.__timer__ = setInterval(this.__tick__.bind(this), CHECK_INTERVAL);
    }, Math.round(Math.random() * CHECK_INTERVAL));

    this.emit('connect');

    // TODO: implement pub/sub
  });
};

///////////////////////////////////////////////////////////////////////////////

module.exports = Queue;
module.exports.Error = QueueError;
