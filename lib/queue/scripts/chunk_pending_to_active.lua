-- Move chunk from pending set to active

local taskID = KEYS[1]
local chunkLivetime = ARGV[1]

-- Get first chunk from pending list and remove it
local chunkID = redis.call("lpop", taskID .. ":chunks:pending")

if chunkID == nil then
  return ""
end

-- Add chunk to active set
redis.call("zadd", taskID .. ":chunks:active", chunkLivetime, chunkID)
return chunkID
