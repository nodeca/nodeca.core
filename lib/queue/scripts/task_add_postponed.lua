-- Create a postponed task, overwrite if task with the same ID already exists

local prefix = KEYS[1]
local taskID = KEYS[2]
local workerName = ARGV[1]
local serializedData = ARGV[2]
local time = ARGV[3]

-- Add task to postponed set
redis.call("zadd", prefix .. "postponed", time, taskID)
-- Save task options
redis.call("hmset", taskID .. ":postponed", "data", serializedData, "type", workerName, "retries", 0, "state", "pending")
