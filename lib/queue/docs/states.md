## Task state lifecycle

- **PENDING** is the initial state for all new tasks created with `push()`. Available transitions:
  - to **MAPPING** before running `map`
- **MAPPING** transitions:
  - to **MAPPING** by a watchdog if `map` function freezes
  - to **MAPPING** in case `map` function returns an error
  - to **AGGREGATING** after `map` succeeds
- **AGGREGATING** transitions:
  - to **REDUCING** after all chunks are finished
- **REDUCING** is the last task state. Task will be removed from redis when `reduce` is complete. Available transitions:
  - to **REDUCING** by watchdog if `reduce` function freezes
  - to **REDUCING** in case `reduce` function returns an error

## Chunk state lifecycle

- **PENDING** is the initial state for all new chunks. Available transitions:
  - to **ACTIVE** before running `process`
- **ACTIVE** transitions:
  - to **PENDING** by watchdog if `process` function freezes
  - to **ERRORED** in case `process` function returns an error
  - to **DONE** after `process` succeeds
- **ERRORED** transitions:
  - to **PENDING** after retry delay
- **DONE** is the last task state

## Redis data structure

All keys starts with prefix defined in constructor, "queue:" by default.

- pending (zset) - incoming tasks IDs
- mapping (zset) - tasks with `mapping` state
- aggregating (set)  - tasks with `aggregating` state
- reducing (zset) - tasks with `reducing` state
- &lt;taskID&gt; (hash) - task options (type, retries, state, data)
- &lt;taskID&gt;:chunks:pending (set)  - pending chunks IDs
- &lt;taskID&gt;:chunks:active (zset) - active chunks IDs
- &lt;taskID&gt;:chunks:errored (zset) - errored chunks IDs
- &lt;taskID&gt;:chunks:done (set)  - finished chunks IDs
- &lt;taskID&gt;:&lt;chunkID&gt; (hash) - chunk's data (retries, data, result)
