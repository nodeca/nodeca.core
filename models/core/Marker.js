// Content marker for forum topic lists, blog entries and so on
//
// Redis keys:
//
// - `marker_cut:<user_id>:<section_id>` (key) - contain timestamp of read cut
// - `marker_marks:<user_id>` (zset) - contain `_id` of read content and timestamp as index
// - `marker_pos:<user_id>` (hash) - content postinion
//   - <content_id> (JSON)
//     - `current`
//     - `max` - last read
//     - `ts` - last update
// - `marker_pos_updates` (zset) - last update info for `marker_pos:*`
// - `marker_cut_updates` (zset) - last update info for `marker_cut:*`
// - `marker_marks_items` (set) - items list for `marker_marks:*`
//
'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function (N, collectionName) {

  function Marker() {
  }


  // Mark content as read
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - callback (Function) - `function (err)`
  //
  Marker.mark = function (userId, contentId, callback) {
    if (!userId || String(userId) === '000000000000000000000000') {
      callback();
      return;
    }

    N.settings.get('content_read_marks_expire', function (err, content_read_marks_expire) {
      if (err) {
        callback(err);
        return;
      }

      var lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);

      // Don't mark old content
      if (contentId.getTimestamp() < lastTs) {
        callback();
        return;
      }

      N.redis.sadd('marker_marks_items', userId, function (err) {
        if (err) {
          callback(err);
          return;
        }

        N.redis.zadd('marker_marks:' + userId, +contentId.getTimestamp(), contentId, callback);
      });
    });
  };


  // Mark all topics before now as read
  //
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - callback (Function) - `function (err)`
  //
  Marker.markAll = function (userId, categoryId, callback) {
    if (!userId || String(userId) === '000000000000000000000000') {
      callback();
      return;
    }

    var now = Date.now();

    N.redis.zadd('marker_cut_updates', now, userId + ':' + categoryId, function (err) {
      if (err) {
        callback(err);
        return;
      }

      N.redis.set('marker_cut:' + userId + ':' + categoryId, now, callback);
    });
  };


  // Remove extra position markers if user have more than limit
  //
  function limitPositionMarkers(userId, callback) {
    var maxItems = 1000;
    var gcThreshold = maxItems + Math.round(maxItems * 0.10) + 1;

    // Get position records count
    N.redis.hlen('marker_pos:' + userId, function (err, cnt) {
      if (err) {
        callback(err);
        return;
      }

      // If count less than limit - skip
      if (cnt <= gcThreshold) {
        callback();
        return;
      }

      N.redis.hgetall('marker_pos:' + userId, function (err, items) {
        if (err) {
          callback(err);
          return;
        }

        var query = N.redis.multi();

        _(items)
          .mapValues(function (json, id) {
            var result = { ts: -1 };

            if (json) {
              try {
                result = JSON.parse(json);
              } catch (__) {}
            }

            result.id = id;

            return result;
          })
          .sortBy('ts')
          .take(_.values(items).length - maxItems)
          .forEach(function (item) {
            query.hdel('marker_pos:' + userId, item.id);
            query.zrem('marker_pos_updates', userId + ':' + item.id);
          })
          .commit();

        query.exec(callback);
      });
    });
  }


  // Set current scroll position in topic
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - position (Number) - post number in thread (post hid)
  // - max (Number) - last read post in thread
  // - callback (Function) - `function (err)`
  //
  Marker.setPos = function (userId, contentId, position, max, callback) {
    if (!userId || String(userId) === '000000000000000000000000') {
      callback();
      return;
    }

    var now = Date.now();

    N.redis.hget('marker_pos:' + userId, contentId, function (err, posJson) {
      if (err) {
        callback(err);
        return;
      }

      var pos;

      if (posJson) {
        try {
          pos = JSON.parse(posJson);
        } catch (__) {}
      }

      pos = pos || { max: max, current: position, ts: +now };

      if (pos.max < max) {
        pos.max = max;
      }

      pos.current = position;
      pos.ts = +now;

      N.redis.zadd('marker_pos_updates', now, userId + ':' + contentId, function (err) {
        if (err) {
          callback(err);
          return;
        }

        N.redis.hset('marker_pos:' + userId, contentId, JSON.stringify(pos), function (err) {
          if (err) {
            callback(err);
            return;
          }

          limitPositionMarkers(userId, callback);
        });
      });
    });
  };


  // Build content info
  //
  // - userId (ObjectId)
  // - contentData ([Object])
  //   - categoryId (ObjectId)
  //   - contentId (ObjectId)
  //   - lastPosition (Number) - last post number in thread (post hid)
  //   - lastPositionTs (Number)
  // - callback (Function) - `function (err, result)`
  //   - result (Hash) - key is `contentId` value is object
  //     - isNew (Boolean) - is topic already opened by user (or older than 30 days)
  //     - next (Number) - hid of first unread post in topic or `-1` if not set
  //     - position (Number) - last read post position or `-1` if not set
  //
  Marker.info = function (userId, contentData, callback) {
    var result = {};

    contentData.forEach(function (item) {
      result[item.contentId] = { isNew: false, next: -1, position: -1 };
    });

    if (!userId || String(userId) === '000000000000000000000000' || contentData.length === 0) {
      callback(null, result);
      return;
    }

    var lastTs;
    var cuts = {};

    async.series([
      // Fetch mark expire setting
      function (next) {
        N.settings.get('content_read_marks_expire', function (err, content_read_marks_expire) {
          if (err) {
            next(err);
            return;
          }

          lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);
          next();
        });
      },

      // Set `isNew` flag by cut
      function (next) {
        var categoryIds = _.uniq(_.pluck(contentData, 'categoryId'));

        categoryIds = categoryIds.map(function (id) {
          return String(id);
        });

        var cutKeys = categoryIds.map(function (id) {
          return 'marker_cut:' + userId + ':' + id;
        });

        N.redis.mget(cutKeys, function (err, res) {
          if (err) {
            next(err);
            return;
          }

          categoryIds.forEach(function (id, i) {
            cuts[id] = res[i] || lastTs;
          });

          contentData.forEach(function (item) {
            if (item.contentId.getTimestamp() > cuts[item.categoryId]) {
              result[item.contentId].isNew = true;
            }
          });

          next();
        });
      },

      // Unset `isNew` flag by markers
      function (next) {
        var newCandidates = [];
        var query = N.redis.multi();

        _.forEach(result, function (v, id) {
          if (v.isNew) {
            query.zscore('marker_marks:' + userId, id);
            newCandidates.push(id);
          }
        });

        query.exec(function (err, res) {
          if (err) {
            next(err);
            return;
          }

          _.forEach(newCandidates, function (id, n) {
            if (res[n] !== null) {
              result[id].isNew = false;
            }
          });

          next();
        });
      },

      // Fill position info
      function (next) {
        var contentIds = _.keys(result);
        var query = N.redis.multi();
        var max;

        contentIds.forEach(function (id) {
          query.hget('marker_pos:' + userId, id);
        });

        query.exec(function (err, posInfo) {
          if (err) {
            next(err);
            return;
          }

          posInfo = posInfo.map(function (json) {
            var result;

            if (json) {
              try {
                result = JSON.parse(json);
              } catch (__) {}
            }

            return result;
          });

          _.forEach(contentData, function (item) {
            max = (posInfo[contentIds.indexOf(String(item.contentId))] || {}).max || -1;
            result[item.contentId].position = (posInfo[contentIds.indexOf(String(item.contentId))] || {}).current || -1;

            if (max === -1 || item.lastPositionTs < cuts[item.categoryId]) {
              result[item.contentId].next = -1;
            } else if (item.lastPosition > max) {
              result[item.contentId].next = +max + 1;
            }
          });
          next();
        });
      }
    ], function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, result);
    });
  };


  // Cleanup deprecated markers (older than 30 days)
  //
  // - callback (Function) - `function (err)`
  //
  Marker.cleanup = function (callback) {
    N.settings.get('content_read_marks_expire', function (err, content_read_marks_expire) {
      if (err) {
        callback(err);
        return;
      }

      var lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);

      // Here could be `async.parallel` but we don't need callbacks


      // Cleanup position markers
      //
      N.redis.zrangebyscore('marker_pos_updates', '-inf', lastTs, function (err, items) {
        if (err) {
          return;
        }

        var query = N.redis.multi();

        items.forEach(function (item) {
          var parts = item.split(':');

          query.hdel('marker_pos:' + parts[0], parts[1]);
          query.zrem('marker_pos_updates', item);
        });

        query.exec();
      });


      // Cleanup cut markers
      //
      N.redis.zrangebyscore('marker_cut_updates', '-inf', lastTs, function (err, items) {
        if (err) {
          return;
        }

        var query = N.redis.multi();

        items.forEach(function (item) {
          query.del('marker_cut:' + item);
          query.zrem('marker_cut_updates', item);
        });

        query.exec();
      });


      // Cleanup read markers
      //
      N.redis.smembers('marker_marks_items', function (err, items) {
        if (err) {
          return;
        }

        var query = N.redis.multi();

        items.forEach(function (item) {
          query.zremrangebyscore('marker_marks:' + item, '-inf', lastTs);
          query.zcard('marker_marks:' + item);
        });

        query.exec(function (err, res) {
          if (err) {
            return;
          }

          var query = N.redis.multi();
          items.forEach(function (item, i) {
            if (res[i * 2 + 1] === 0) {
              query.srem('marker_marks_items', item);
            }
          });

          query.exec();
        });
      });


      callback();
    });
  };


  N.wire.on('init:models', function emit_init_Marker(__, callback) {
    N.wire.emit('init:models.' + collectionName, Marker, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Marker() {
    N.models[collectionName] = Marker;
  });
};
