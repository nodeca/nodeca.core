## API

### new Queue(redis, prefix)

 - **redis** (RedisClient) - redis client instance
 - **prefix** (String) - optional. Redis keys prefix, "queue:" by default

### Queue#registerWorker(name, worker)

 - **name** (String) - the worker's name
 - **worker** (Function) - called as: `function (params, callback)`
   - **params** (Object) - task params
   - **callback** (Function) - called as: `function (err)`

### Queue#registerWorker(options)

Options:

 - **name** (String) - the worker's name
 - **taskID** (Function) - optional, should return new task id. Needed only for
   creating exclusive tasks, return random value by default, called as: `function (taskData)`
 - **chunksPerInstance** (Number) - optional, available count of parallel chunks in one
   process (Infinity - not restricted), default Infinity
 - **retry** (Number) - optional, number of retry on error, default 2
 - **retryDelay** (Number) - optional, delay in ms after retries, default 60000 ms
 - **timeout** (Number) - optional, `map`, `chunk` and `reduce` execution timeout, default 30000 ms
 - **cron** (String) - optional, cron string ("15 \*/6 \* \* \*"), default null
 - **map** (Function) - optional, proxy taskData to single chunk by default,
   called as: `function (taskData, callback)`
   - **taskData** (Object)
   - **callback** (Function) - called as: `function (err, chunksData)`
     - **chunksData** (Array) - array of chunks data
 - **process** (Function) - called as: `function (chunkData, callback)`
   - **chunkData** (Object)
   - **callback** (Function) - called as: `function (err, result)`
 - **reduce** (Function) - optional, only call `callback` by default,
   called as: `function (chunksResult, callback)`
   - **chunksResult** (Array) - array of chunks results
   - **callback** (Function) - called as: `function (err)`

### Queue#push(workerName, taskData, callback)

Run the task immediately.

 - **workerName** (String) - the worker name
 - **taskData** (Object) - optional, the task params
 - **callback** (Function) - called as: `function (err)`

### Queue#shutdown()

Stop accepting new tasks from queue. Active tasks continue execution.

### Queue#on('error', callback)

`Queue` is an `EventEmitter` instance that only fires `error` event when an error has occured.

