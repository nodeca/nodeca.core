-- Move task from pending to mapping

local prefix = KEYS[1]
local taskID = KEYS[2]
local taskLivetime = ARGV[1]

-- Check if task in pending set and remove it
if redis.call("srem", prefix .. "pending", taskID) == 1 then
  -- Add task to mapping zset
  redis.call("zadd", prefix .. "mapping", taskLivetime, taskID)
  -- Change task state
  redis.call("hset", taskID, "state", "mapping")
  return 1
end
return 0
