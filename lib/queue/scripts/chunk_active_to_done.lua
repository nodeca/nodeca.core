-- Move chunk from active set to done set and set result

local taskID = KEYS[1]
local chunkID = KEYS[2]
local chunkResult = ARGV[1]

-- Check if chunk in active set and remove it
if redis.call("zrem", taskID .. ":chunks:active", chunkID) == 1 then
  -- Add chunk to aggregating set
  redis.call("sadd", taskID .. ":chunks:done", chunkID)
  -- Update chunk options
  redis.call("hset", chunkID, "result", chunkResult)
  return 1
end
return 0
