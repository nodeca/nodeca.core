-- Move task from postponed to pending

local prefix = KEYS[1]
local taskID = KEYS[2]

-- Check if task is not running yet
if redis.call("exists", taskID) == 0 then
  -- Remove task from postponed set
  redis.call("zrem", prefix .. "postponed", taskID)
  -- Add task to pending set
  redis.call("sadd", prefix .. "pending", taskID)
  -- Save task options
  redis.call("rename", taskID .. ":postponed", taskID)
  return 1
end
return 0
