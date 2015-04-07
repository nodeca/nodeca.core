-- Move task from aggregating to reducing

local prefix = KEYS[1]
local taskID = KEYS[2]
local taskLivetime = ARGV[1]

-- Check if task in aggregating set and remove it
if redis.call("srem", prefix .. "aggregating", taskID) == 1 then
  -- Add task to reducing zset
  redis.call("zadd", prefix .. "reducing", taskLivetime, taskID)
  -- Update task options
  redis.call("hmset", taskID, "retries", 0, "state", "reducing")
  return 1
end
return 0
