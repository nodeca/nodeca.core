-- Move chunk from active to errored

local taskID = KEYS[1]
local chunkID = KEYS[2]
local retryTimeout = ARGV[1]
local oldScore = ARGV[2]

-- Check if chunk in active set
if redis.call("zscore", taskID .. ":chunks:active", chunkID) == oldScore then
  -- Remove chunk from active
  redis.call("zrem", taskID .. ":chunks:active", chunkID)
  -- Add chunk to errored set
  redis.call("zadd", taskID .. ":chunks:errored", retryTimeout, chunkID)
  -- Increment retries count
  redis.call("hincrby", chunkID, "retries", 1)
  return 1
end
return 0
