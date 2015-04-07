-- Check if task not exists and create it

local prefix = KEYS[1]
local taskID = KEYS[2]
local workerName = ARGV[1]
local serializedData = ARGV[2]

-- Check if task not exists yet
if redis.call("exists", taskID) == 0 then
  -- Add task to pending set
  redis.call("sadd", prefix .. "pending", taskID)
  -- Save task options
  redis.call("hmset", taskID, "data", serializedData, "type", workerName, "retries", 0, "state", "pending")
  return 1
end
return 0
