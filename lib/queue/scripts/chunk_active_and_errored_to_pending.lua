-- Move chunk from errored and active to pending

local taskID = KEYS[1]
local deadline = ARGV[1]

-- Get errored chunks
local errored = redis.call("zrangebyscore", taskID .. ":chunks:errored", "-inf", deadline)

for _, chunkID in ipairs(errored) do
  -- Remove chunk from errored
  redis.call("zrem", taskID .. ":chunks:errored", chunkID)
  -- Add chunk to pending set
  redis.call("lpush", taskID .. ":chunks:pending", chunkID)
end

-- Get suspended chunks
local suspended = redis.call("zrangebyscore", taskID .. ":chunks:active", "-inf", deadline)

for _, chunkID in ipairs(suspended) do
  -- Remove chunk from active
  redis.call("zrem", taskID .. ":chunks:active", chunkID)
  -- Add chunk to pending set
  redis.call("lpush", taskID .. ":chunks:pending", chunkID)
  -- Increment retries count
  redis.call("hincrby", chunkID, "retries", 1)
end
