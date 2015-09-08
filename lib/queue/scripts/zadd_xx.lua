-- Equivalent for "ZADD zset XX score key" for redis 2.8
-- TODO: remove it when we switch to 3.0.2+

local zset  = KEYS[1]
local score = ARGV[1]
local key   = ARGV[2]

if redis.call("zscore", zset, key) then
  redis.call("zadd", zset, score, key)
end
