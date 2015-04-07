-- Update chunk livetime and retries count on error or by watchdog

local taskID = KEYS[1]
local chunkID = KEYS[2]
local chunkLivetime = ARGV[1]
local oldScore = ARGV[2]

-- Check if chunk in active set
if redis.call("zscore", taskID .. ":chunks:active", chunkID) == oldScore then
  -- Update chunk livetime
  redis.call("zadd", taskID .. ":chunks:active", chunkLivetime, chunkID)
  -- Increment retries count
  redis.call("hincrby", chunkID, "retries", 1)
  return 1
end
return 0
