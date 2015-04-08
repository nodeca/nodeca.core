// Queue class
//
// Redis keys structure (all keys starts with prefix defined in constructor, "queue:" by default):
//
// - pending                 (set)  - incoming tasks IDs
// - mapping                 (zset) - tasks with state `mapping`
// - aggregating             (set)  - tasks with state `aggregating`
// - reducing                (zset) - tasks with state `reducing`
// - <taskID>                (hash) - task options (type, retries, state, data)
// - <taskID>:chunks:pending (set)  - pending chunks IDs
// - <taskID>:chunks:active  (zset) - active chunks IDs
// - <taskID>:chunks:done    (set)  - finished chunks IDs
// - <taskID>:<chunkID>      (hash) - chunk's data (retries, data, result)
//
'use strict';


var CronJob      = require('cron').CronJob;
var randomBytes  = require('crypto').randomBytes;
var inherits     = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var path         = require('path');
var fs           = require('fs');


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
///////////////////////////////////////////////////////////////////////////////


// Constructor
//
// - redis (RedisClient) - redis client instance
// - prefix (String) - optional. Redis keys prefix, "queue:" by default
//
function Queue(redis, prefix) {
  this.__redis__ = redis;
  this.__timer__ = null;
  this.__stopped__ = false;
  this.__workers__ = {};
  this.__prefix__ = prefix || 'queue:';

  var scripts = {};

  // Read lua scripts
  fs.readdirSync(path.join(__dirname, 'scripts')).forEach(function (fileName) {
    scripts[path.basename(fileName, '.lua')] = fs.readFileSync(path.join(__dirname, 'scripts', fileName), 'utf-8');
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
// registerWorker(name, worker):
//
// - name (String) - the worker's name
// - cron (String) - optional, cron string ("15 */6 * * *"), default null
// - worker(Function) - called as: `function (params, callback)`
//   - params (Object) - task params
//   - callback (Function) - called as: `function (err)`
//
// registerWorker(options):
//
// - options (Object)
//   - name (String) - the worker's name
//   - taskID (Function) - optional, should return new task id. Needed only for
//     creating exclusive tasks, return random value by default, called as: `function (taskData)`
//   - chunksPerInstance (Number) - optional, available count of parallel chunks in one
//     process (Infinity - not restricted), default Infinity
//   - retry (Number) - optional, number of retry on error, default 2
//   - retryDelay (Number) - optional, delay in sec after retries, default 60
//   - timeout (Number) - optional, `map`, `chunk` and `reduce` execution timeout, default 30 sec
//   - cron (String) - optional, cron string ("15 */6 * * *"), default null
//   - map (Function) - optional, proxy taskData to single chunk by default,
//     called as: `function (taskData, callback)`
//     - taskData (Object)
//     - callback (Function) - called as: `function (err, chunksData)`
//       - chunksData (Array) - array of chunks data
//   - process (Function) - called as: `function (chunkData, callback)`
//     - chunkData (Object)
//     - callback (Function) - called as: `function (err, result)`
//   - reduce (Function) - optional, only call `callback` by default,
//     called as: `function (chunksResult, callback)`
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

  options.retry = options.retry || 2;
  options.retryDelay = options.retryDelay || 60;

  options.timeout = options.timeout || 30;

  options.map = options.map || function (taskData, callback) {
    callback(null, [ taskData ]);
  };

  options.reduce = options.reduce || function (chunksResult, callback) {
    callback();
  };

  options.taskID = options.taskID || function () {
    return options.name + ':' + randomBytes(20).toString('hex');
  };

  options.chunksPerInstance = options.chunksPerInstance || Infinity;

  options.chunksTracker = {};

  this.__workers__[options.name] = options;

  if (options.cron) {
    this.__schedule__(options);
  }
};


// Run the task immediately
//
// - workerName (String) - the worker name
// - taskData (Object) - optional, the task params
// - callback (Function) - called as: `function (err)`
//
Queue.prototype.push = function (workerName, taskData, callback) {
  if (!callback) {
    callback = taskData;
    taskData = null;
  }

  this.__addTask__(workerName, taskData, callback);
};


// Postpone the task executions
//
// - workerName (String) - the worker name
// - taskData (Object) - optional, the task params
// - time (Number || Date) - run at defined time
// - callback (Function) - called as: `function (err)`
//
// Queue.prototype.postpone = function (workerName, taskData, time, callback) {
//  // TODO: implement
// };


// Stop accepting new tasks from queue. Active tasks continue execution
//
Queue.prototype.shutdown = function () {
  this.__stopped__ = true;
};


///////////////////////////////////////////////////////////////////////////////
// Private methods


// Schedule the task executions
//
// - worker (Object) - worker options
//
Queue.prototype.__schedule__ = function (worker) {
  var self = this;

  var job = new CronJob(worker.cron, function scheduledRun() {
    if (self.__stopped__) {
      return;
    }

    // To generate `sheduledID` we use timestamp of next exec because `node-cron`
    // doesn't present timestamp of current exec
    var scheduledID = [ self.__prefix__, 'cron:', worker.name, ':', this.cronTime.sendAt().format('X') ].join('');

    // Check if another instance scheduled the task
    self.__redis__.setnx(scheduledID, scheduledID, function (err, acquired) {
      if (err) {
        self.emit('error', err);
        return;
      }

      // Exit if the task already scheduled in different instance
      if (!acquired) {
        return;
      }

      // Set tracker lifetime (3 days) to auto collect garbage
      self.__redis__.expire(scheduledID, 72 * 60 * 60 * 1000, function (err) {
        if (err) {
          self.emit('error', err);
          return;
        }

        self.__addTask__(worker.name, null, function (err) {
          if (err) {
            self.emit('error', err);
          }
        });
      });
    });
  });

  job.start();
};


// Add new task to pending set
//
// - workerName (String) - the worker name
// - taskData (Object) - serializable task data, will be passed to `map`
// - callback (Function)
//
Queue.prototype.__addTask__ = function (workerName, taskData, callback) {
  var self = this;
  var worker = this.__workers__[workerName];

  // Skip if worker not registered on this instance
  if (!worker) {
    callback(new Error('Queue add task error: worker with name "' + workerName + '" not exists.'));
    return;
  }

  // Add global prefix to every task ID
  var taskID = self.__prefix__ + worker.taskID(taskData);

  // Check that the task not exists yet and add
  //
  // - prefix
  // - task ID
  // - worker name
  // - task data
  //
  self.__redis__.eval(
    self.__scripts__.task_add,
    2,
    self.__prefix__,
    taskID,
    workerName,
    JSON.stringify(taskData),
    callback
  );
};


// Map task
//
// - taskID (String) - the task ID
// - worker (Object) - the worker options
// - data (Object) - task data
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doMap__ = function (taskID, worker, data, timestamp) {
  var self = this;

  // Execute worker's map to get chunks
  worker.map(data, function (err, chunksData) {

    // On error we should postpone next map execution
    if (err) {
      // Send error event with error, worker name and task ID to have ability group errors
      self.emit('error', new QueueError(err, worker.name, 'mapping', taskID, null, data));

      // Get redis current time to set retry timeout
      self.__redis__.time(function (err, time) {
        // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
        if (err) {
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
        self.__redis__.eval(
          self.__scripts__.task_mapping_to_mapping,
          2,
          self.__prefix__,
          taskID,
          +time[0] + worker.retryDelay,
          timestamp,
          function (err) {
            if (err) {
              self.emit('error', err);
              return;
            }
          }
        );
      });
      return;
    }

    // Process arguments for `task_mapping_to_aggregating` script

    // Set prefix
    var args = [ self.__prefix__ ];

    // Set chunks IDs
    args = args.concat(chunksData.map(function (__, i) {
      return taskID + ':' + i;
    }));

    // Set `taskID`
    args.push(taskID);

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
    self.__redis__.eval(args, function (err, moved) {
      if (err) {
        self.emit('error', err);
        return;
      }

      if (!moved) {
        return;
      }

      // On success try do next step immediately to minimize latency
      self.__doAggregate__(taskID);
    });
  });
};


// Update task's deadline in mapping set and run again suspended or errored `map`
//
// - taskID (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryMapping__ = function (taskID, timestamp) {
  var self = this;

  // Get redis time and task options
  self.__redis__.multi()
      .time()
      .hmget(taskID, 'data', 'type', 'retries')
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var time = data[0];
    var taskData = data[1][0];
    var taskType = data[1][1];
    var taskRetries = data[1][2];

    var worker = self.__workers__[taskType];

    // Skip if worker not registered on this instance
    if (!worker) {
      return;
    }

    // Check if retry count exceeded
    if (taskRetries > worker.retry) {
      self.__deleteTask__(taskID);
      return;
    }

    var deadline = +time[0] + worker.timeout;

    // Update task timeout deadline. Params:
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    // - old timestamp to be sure what watchdog did not updated this task in retry attempt
    //
    self.__redis__.eval(
      self.__scripts__.task_mapping_to_mapping,
      2,
      self.__prefix__,
      taskID,
      deadline,
      timestamp,
      function (err, updated) {
        if (err) {
          self.emit('error', err);
          return;
        }

        // If another process got task - skip
        if (!updated) {
          return;
        }

        // Execute map
        self.__doMap__(taskID, worker, JSON.parse(taskData), deadline);
      }
    );
  });
};


// Move task from pending to mapping and run `map`
//
// - taskID (String) - the task ID
//
Queue.prototype.__consumeTask__ = function (taskID) {
  var self = this;

  // Get redis time and task options
  self.__redis__.multi()
      .time()
      .hmget(taskID, 'data', 'type')
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var time = data[0];
    var taskData = data[1][0];
    var taskType = data[1][1];

    var worker = self.__workers__[taskType];

    // Skip if worker not registered on this instance
    if (!worker) {
      return;
    }

    var deadline = +time[0] + worker.timeout;

    // Try move task from pending set to mapping set. Params
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    //
    self.__redis__.eval(
      self.__scripts__.task_pending_to_mapping,
      2,
      self.__prefix__,
      taskID,
      deadline,
      null,
      function (err, moved) {
        if (err) {
          self.emit('error', err);
          return;
        }

        // If another process got task - skip
        if (!moved) {
          return;
        }

        // Execute map
        self.__doMap__(taskID, worker, JSON.parse(taskData), deadline);
      }
    );
  });
};


// Process single chunk
//
// - worker (Object) - the worker options
// - taskID (String) - the task ID
// - chunkID (String) - the chunk ID
// - data (Object) - chunk data
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doProcess__ = function (worker, taskID, chunkID, data, timestamp) {
  var self = this;

  // Execute worker's chunk to get result
  worker.process(data, function (err, result) {
    // On error we should postpone next chunk execution
    if (err) {
      // Send error event with error, worker name, task ID and chunk ID to have ability group errors
      self.emit('error', new QueueError(err, worker.name, 'aggregating', taskID, chunkID, data));

      // Get redis current time to set retry timeout
      self.__redis__.time(function (err, time) {
        // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
        if (err) {
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
        self.__redis__.eval(
          self.__scripts__.chunk_active_to_active,
          2,
          taskID,
          chunkID,
          +time[0] + worker.retryDelay,
          timestamp,
          function (err) {
            if (err) {
              self.emit('error', err);
              return;
            }

            worker.chunksTracker[taskID]--;
          }
        );
      });
      return;
    }

    // Move chunk to finished. Params:
    //
    // - task ID
    // - chunk ID
    // - chunk result or null
    //
    self.__redis__.eval(
      self.__scripts__.chunk_active_to_done,
      2,
      taskID,
      chunkID,
      JSON.stringify(result || null),
      null,
      function (err, moved) {
        if (err) {
          self.emit('error', err);
          return;
        }

        // Decrement ran chunks count on this instance to allow get one more
        worker.chunksTracker[taskID]--;

        if (moved) {
          // On success try do next step immediately to minimize latency
          self.__doAggregate__(taskID);
        }
      }
    );
  });
};


// Move chunk from pending to active and execute it
//
// - worker (Object) - the worker options
// - taskID (String) - the task ID
// - chunkID (String) - the chunk ID
//
Queue.prototype.__consumeChunk__ = function (worker, taskID, chunkID) {
  var self = this;

  // Get redis time and task options
  self.__redis__.multi()
      .time()
      .hget(chunkID, 'data')
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var time = data[0];
    var chunkData = data[1];

    var deadline = +time[0] + worker.timeout;

    // Try move chunk from pending set to active set. Params:
    //
    // - task ID
    // - chunk UD
    // - timestamp of max chunk's age
    //
    self.__redis__.eval(
      self.__scripts__.chunk_pending_to_active,
      2,
      taskID,
      chunkID,
      deadline,
      null,
      function (err, moved) {
        if (err) {
          self.emit('error', err);
          return;
        }

        // If another process got chunk - skip
        if (!moved) {
          return;
        }

        self.__doProcess__(worker, taskID, chunkID, JSON.parse(chunkData), deadline);
      }
    );
  });
};


// Update chunk's deadline in active set and run again suspended or errored chunk
//
// - worker (Object) - the worker options
// - taskID (String) - the task ID
// - chunkID (String) - the chunk ID
// - timestamp (Number) - old chunk's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryChunk__ = function (worker, taskID, chunkID, timestamp) {
  var self = this;

  // Get redis time and task options
  self.__redis__.multi()
      .time()
      .hmget(chunkID, 'data', 'retries')
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var time = data[0];
    var chunkData = data[1][0];
    var chunkRetries = data[1][1];

    // Check if retry count exceeded
    if (chunkRetries > worker.retry) {
      self.__deleteChunk__(taskID, chunkID);
      return;
    }

    var deadline = +time[0] + worker.timeout;

    // Update chunk deadline. Params:
    //
    // - task ID
    // - chunk ID
    // - max chunk's age
    // - old timestamp to be sure what watchdog did not updated this chunk in retry attempt
    //
    self.__redis__.eval(
      self.__scripts__.chunk_active_to_active,
      2,
      taskID,
      chunkID,
      deadline,
      timestamp,
      function (err, moved) {
        if (err) {
          self.emit('error', err);
          return;
        }

        if (!moved) {
          return;
        }

        worker.chunksTracker[taskID]++;
        self.__doProcess__(worker, taskID, chunkID, JSON.parse(chunkData), deadline);
      }
    );
  });
};


// Reduce task
//
// - taskID (String) - the task ID
// - worker (Object) - the worker options
// - timestamp (Number) - used to avoid races on retrying task by watchdog
//
Queue.prototype.__doReduce__ = function (worker, taskID, timestamp) {
  var self = this;

  self.__redis__.smembers(taskID + ':chunks:done', function (err, chunksIDs) {
    if (err) {
      self.emit('error', err);
      return;
    }

    var query = self.__redis__.multi();

    chunksIDs.forEach(function (chunkID) {
      query.hget(chunkID, 'result');
    });

    query.exec(function (err, chunksResultsStrings) {
      if (err) {
        self.emit('error', err);
        return;
      }

      var chunksResults = [];

      chunksResultsStrings.forEach(function (chunkDataStr) {
        chunksResults.push(JSON.parse(chunkDataStr));
      });

      worker.reduce(chunksResults, function (err) {

        // On error we should postpone next reduce execution
        if (err) {
          // Send error event with error, worker name and task ID to have ability group errors
          self.emit('error', new QueueError(err, worker.name, 'reducing', taskID, null, chunksResults));

          // Get redis current time to set retry timeout
          self.__redis__.time(function (err, time) {
            // If error caused by redis restart/crash, the task will be retried after 'timeout' anyway
            if (err) {
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
            self.__redis__.eval(
              self.__scripts__.task_reducing_to_reducing,
              2,
              self.__prefix__,
              taskID,
              +time[0] + worker.retryDelay,
              timestamp,
              function (err) {
                if (err) {
                  self.emit('error', err);
                  return;
                }
              }
            );
          });
          return;
        }

        // Delete task when it is finished
        self.__deleteTask__(taskID);
      });
    });
  });
};


// Update task's deadline in reducing set and run again suspended or errored `reduce`
//
// - taskID (String) - the task ID
// - timestamp (Number) - old task's deadline. Used to avoid races on retrying task by watchdog
//
Queue.prototype.__retryReducing__ = function (taskID, timestamp) {
  var self = this;

  // Get redis time and task options
  self.__redis__.multi()
      .hmget(taskID, 'type', 'retries')
      .time()
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var taskType = data[0][0];
    var taskRetries = data[0][1];
    var time = data[1];

    var worker = self.__workers__[taskType];

    // Skip if worker not registered on this instance
    if (!worker) {
      return;
    }

    // Check if retry count exceeded
    if (taskRetries > worker.retry) {
      self.__deleteTask__(taskID);
      return;
    }

    var deadline = +time[0] + worker.timeout;

    // Update task deadline. Params:
    //
    // - prefix
    // - task ID
    // - timestamp of max task age
    // - old timestamp to be sure what watchdog did not updated this task in retry attempt
    //
    self.__redis__.eval(
      self.__scripts__.task_reducing_to_reducing,
      2,
      self.__prefix__,
      taskID,
      deadline,
      timestamp,
      function (err, updatetd) {
        if (err) {
          self.emit('error', err);
          return;
        }

        // If another process got task - skip
        if (!updatetd) {
          return;
        }

        self.__doReduce__(worker, taskID, deadline);
      }
    );
  });
};


// Delete chunk ID from `<taskID>:chunks:*` sets and delete `<chunkID>` hash
//
// - taskID (String) - the task ID
// - chunkID (String) - the chunk ID
//
Queue.prototype.__deleteChunk__ = function (taskID, chunkID) {
  var self = this;

  self.__redis__.multi()
      .srem(taskID + ':chunks:pending', chunkID)
      .zrem(taskID + ':chunks:active', chunkID)
      .srem(taskID + ':chunks:done', chunkID)
      .del(chunkID)
      .exec(function (err) {

    if (err) {
      self.emit('error', err);
      return;
    }
  });
};


// Delete task from all sets and delete all keys associated with task
//
// - taskID (String) - the task ID
//
Queue.prototype.__deleteTask__ = function (taskID) {
  var self = this;

  // Get all chunks IDs
  self.__redis__.multi()
      .smembers(taskID + ':chunks:pending')
      .zrange(taskID + ':chunks:active', 0, -1)
      .smembers(taskID + ':chunks:done')
      .exec(function (err, result) {

    if (err) {
      self.emit('error', err);
      return;
    }

    // Process all keys associated with task
    var keys = [
      taskID,
      taskID + ':chunks:pending',
      taskID + ':chunks:active',
      taskID + ':chunks:done'
    ]
      // Chunks IDs from `<taskID>:chunks:pending`
      .concat(result[0])
      // Chunks IDs from `<taskID>:chunks:active`
      .concat(result[1])
      // Chunks IDs from `<taskID>:chunks:done`
      .concat(result[2]);

    self.__redis__.multi()
        // Remove task from all queue sets
        .srem(self.__prefix__ + 'pending', taskID)
        .zrem(self.__prefix__ + 'mapping', taskID)
        .srem(self.__prefix__ + 'aggregating', taskID)
        .zrem(self.__prefix__ + 'reducing', taskID)
        // Remove task keys
        .del(keys)
        .exec(function (err) {

      if (err) {
        self.emit('error', err);
        return;
      }
    });
  });
};


// Process chunks or move the task to reducing if chunks done
//
// - taskID (String) - the task ID
//
Queue.prototype.__doAggregate__ = function (taskID) {
  var self = this;

  // Get errored and suspended chunks from active zset
  function retryChunks(worker, limit) {
    self.__redis__.time(function (err, time) {
      if (err) {
        self.emit('error', err);
        return;
      }

      var args = [
        taskID + ':chunks:active',
        '-inf',
        time[0],
        'withscores'
      ];

      if (limit) {
        args = args.concat([
          'limit',
          '0', // is offset
          limit
        ]);
      }

      // Get chunks IDs and its deadlines
      self.__redis__.zrangebyscore(args, function (err, result) {
        if (err) {
          self.emit('error', err);
          return;
        }

        for (var i = 0; i < result.length; i += 2) {
          // `result[i]` contains chunkID, `result[i + 1]` contains its score
          self.__retryChunk__(worker, taskID, result[i], result[i + 1]);
        }
      });
    });
  }

  // Get task type, chunks count in pending and active sets and time
  self.__redis__.multi()
      .hget(taskID, 'type')
      .scard(taskID + ':chunks:pending')
      .zcard(taskID + ':chunks:active')
      .time()
      .exec(function (err, data) {

    if (err) {
      self.emit('error', err);
      return;
    }

    var taskType = data[0];
    var pendingChunksCount = data[1];
    var activeChunksCount = data[2];
    var time = data[3];

    var worker = self.__workers__[taskType];

      // Skip if worker not registered on this instance
    if (!worker) {
      return;
    }

    var deadline = +time[0] + worker.timeout;

    // If all chunks done - change state to reducing
    if (pendingChunksCount === 0 && activeChunksCount === 0) {

      // Move the task from aggregating to reducing and update their state
      //
      // - prefix
      // - task ID
      // - timestamp of max task age
      //
      self.__redis__.eval(
        self.__scripts__.task_aggregating_to_reducing,
        2,
        self.__prefix__,
        taskID,
        deadline,
        null,
        function (err, moved) {
          if (err) {
            self.emit('error', err);
            return;
          }

          // If another process got task - skip
          if (!moved) {
            return;
          }

          self.__doReduce__(worker, taskID, deadline);
        }
      );

      return;
    }

    // Set initial value for `chunksTracker`
    worker.chunksTracker[taskID] = worker.chunksTracker[taskID] || 0;

    // If max chunks count exceeded - skip
    if (worker.chunksTracker[taskID] >= worker.chunksPerInstance) {
      return;
    }

    // Get chunks from pending queue
    //
    var command;
    var args;
    var chunksCount = worker.chunksPerInstance - worker.chunksTracker[taskID];

    // If we can process finite count of chunks - get random chunks from pending queue
    if (isFinite(worker.chunksPerInstance)) {
      command = 'srandmember';
      args = [
        taskID + ':chunks:pending',
        chunksCount
      ];

    // If chunks count not limited - process all chunks
    } else {
      command = 'smembers';
      args = [
        taskID + ':chunks:pending'
      ];
    }

    self.__redis__[command](args, function (err, chunkIDs) {
      if (err) {
        self.emit('error', err);
        return;
      }

      chunkIDs.forEach(function (chunkID) {
        self.__consumeChunk__(worker, taskID, chunkID);
      });

      // Get chunks from active zset if we can get more
      if (chunksCount - chunkIDs.length > 0) {
        retryChunks(worker, isFinite(chunksCount) ? chunksCount - chunkIDs.length : null);
      }
    });
  });
};


// Get and process tasks
//
Queue.prototype.__tick__ = function () {
  var self = this;

  if (self.__stopped__) {
    return;
  }

  // Here could be `async.parallel` but we don't need callbacks


  // Monitor new pending tasks
  //
  self.__redis__.smembers(self.__prefix__ + 'pending', function (err, taskIDs) {
    if (err) {
      self.emit('error', err);
      return;
    }

    taskIDs.forEach(function (taskID) {
      self.__consumeTask__(taskID);
    });
  });


  // Monitor new task's chunks
  //
  self.__redis__.smembers(self.__prefix__ + 'aggregating', function (err, taskIDs) {
    if (err) {
      self.emit('error', err);
      return;
    }

    taskIDs.forEach(function (taskID) {
      self.__doAggregate__(taskID);
    });
  });


  // Watchdog suspended and error tasks at mapping state
  //
  self.__redis__.time(function (err, time) {
    if (err) {
      self.emit('error', err);
      return;
    }

    // Get tasks IDs and its deadlines
    self.__redis__.zrangebyscore(self.__prefix__ + 'mapping', '-inf', time[0], 'withscores', function (err, result) {
      if (err) {
        self.emit('error', err);
        return;
      }

      for (var i = 0; i < result.length; i += 2) {
        // `result[i]` contains taskID, `result[i + 1]` contains its score
        self.__retryMapping__(result[i], result[i + 1]);
      }
    });
  });


  // Watchdog suspended and error tasks at reducing state
  //
  self.__redis__.time(function (err, time) {
    if (err) {
      self.emit('error', err);
      return;
    }

    // Get tasks IDs and its deadlines
    self.__redis__.zrangebyscore(self.__prefix__ + 'reducing', '-inf', time[0], 'withscores', function (err, result) {
      if (err) {
        self.emit('error', err);
        return;
      }

      for (var i = 0; i < result.length; i += 2) {
        // `result[i]` contains taskID, `result[i + 1]` contains its score
        self.__retryReducing__(result[i], result[i + 1]);
      }
    });
  });
};


// Init queue
//
Queue.prototype.__init__ = function () {
  var CHECK_INTERVAL = 500;
  var self = this;

  setTimeout(function () {
    self.__timer__ = setInterval(self.__tick__.bind(self), CHECK_INTERVAL);
  }, Math.round(Math.random() * CHECK_INTERVAL));

  // TODO: implement pub/sub
};

///////////////////////////////////////////////////////////////////////////////

module.exports = Queue;
module.exports.QueueError = QueueError;
