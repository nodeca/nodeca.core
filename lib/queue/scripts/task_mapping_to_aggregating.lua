-- Move task from mapping to aggregating

local prefix = KEYS[1]
local taskID = ARGV[1]

-- Check if task in mapping zset and remove it
if redis.call("zrem", prefix .. "mapping", taskID) == 1 then
  -- Add task to aggregating set
  redis.call("sadd", prefix .. "aggregating", taskID)
  -- Update task options
  redis.call("hmset", taskID, "retries", 0, "state", "aggregating")

  -- Save chunks
  for i = 2, #KEYS do
    redis.call("hmset", KEYS[i], "retries", 0, "data", ARGV[i])
    redis.call("lpush", taskID .. ":chunks:pending", KEYS[i])
  end

  return 1
end
return 0
