# Queue

## Task state lifecycle

- **PENDING** is initial state for all new tasks. Available transitions:
  - to **MAPPING** before run `map`
- **MAPPING** transitions:
  - to **MAPPING** by watchdog, if `map` suspend
  - to **MAPPING** in case of error while `map` execution
  - to **AGGREGATING** after `map` done
- **AGGREGATING** transitions:
  - to **REDUCING** after all chunks done
- **REDUCING** is last task state. Task will be removed from redis when `reduce` complete. Available transitions:
  - to **REDUCING** by watchdog, if `reduce` suspend
  - to **REDUCING** in case of error while `reduce` execution

## Chunk state lifecycle

- **PENDING** is initial state for all new chunks. Available transitions:
  - to **ACTIVE** before run `process`
- **ACTIVE** transitions:
  - to **ACTIVE** by watchdog, if `process` suspend
  - to **ACTIVE** in case of error while `process` execution
  - to **DONE** after `process` done
- **DONE** is last task state

## Redis data structure
All keys starts with prefix defined in constructor, "queue:" by default.

- pending (set)  - incoming tasks IDs
- mapping (zset) - tasks with state mapping
- aggregating (set)  - tasks with state aggregating
- reducing (zset) - tasks with state reducing
- &lt;taskID&gt; (hash) - task options (type, retries, state, data)
- &lt;taskID&gt;:chunks:pending (set)  - pending chunks IDs
- &lt;taskID&gt;:chunks:active (zset) - active chunks IDs
- &lt;taskID&gt;:chunks:done (set)  - finished chunks IDs
- &lt;taskID&gt;:&lt;chunkID&gt; (hash) - chunk's data (retries, data, result)
