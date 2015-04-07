-- Move chunk from pending set to active

local taskID = KEYS[1]
local chunkID = KEYS[2]
local chunkLivetime = ARGV[1]

-- Check if chunk in pending set and remove it
if redis.call("srem", taskID .. ":chunks:pending", chunkID) == 1 then
  -- Add chunk to active set
  redis.call("zadd", taskID .. ":chunks:active", chunkLivetime, chunkID)
  return 1
end
return 0
