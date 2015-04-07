-- Update task livetime and retries count on error or by watchdog

local prefix = KEYS[1]
local taskID = KEYS[2]
local taskLivetime = ARGV[1]
local oldScore = ARGV[2]

-- Check if task in mapping set
if redis.call("zscore", prefix .. "reducing", taskID) == oldScore then
  -- Update task livetime
  redis.call("zadd", prefix .. "reducing", taskLivetime, taskID)
  -- Increment retries count
  redis.call("hincrby", taskID, "retries", 1)
  return 1
end
return 0
