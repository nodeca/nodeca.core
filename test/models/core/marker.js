'use strict';


var assert    = require('assert');
var _         = require('lodash');
var async     = require('async');
var ObjectId  = require('mongoose').Types.ObjectId;


var Marker = TEST.N.models.core.Marker;
var redis  = TEST.N.redis;
var expire;


function randObjectIdByTimestamp(ts) {
  var hexChars = 'abcdef0123456789'.split('');
  var hexSeconds = Math.floor(ts / 1000).toString(16);
  var strId = hexSeconds;

  _.times(16, function () {
    strId += _.sample(hexChars);
  });

  return new ObjectId(strId);
}


describe('Marker', function () {

  before(function (callback) {
    TEST.N.settings.get('content_read_marks_expire', function (err, content_read_marks_expire) {
      if (err) {
        callback(err);
        return;
      }

      expire = content_read_marks_expire * 24 * 60 * 60 * 1000;
      callback();
    });
  });


  describe('.mark()', function () {

    it('should mark', function (done) {
      var uid = new ObjectId();
      var cid = new ObjectId();

      Marker.mark(uid, cid, function (err) {
        if (err) {
          done(err);
          return;
        }


        redis.zscore('marker_marks:' + uid, cid, function (err, res) {
          if (err) {
            done(err);
            return;
          }

          assert.strictEqual(+res, +cid.getTimestamp());

          redis.sismember('marker_marks_items', uid, function (err, res) {
            if (err) {
              done(err);
              return;
            }

            assert.ok(res);
            done();
          });
        });
      });
    });


    it('should skip old', function (done) {
      var uid = new ObjectId();
      var cid = randObjectIdByTimestamp(Date.now() - expire - 1000);

      Marker.mark(uid, cid, function (err) {
        if (err) {
          done(err);
          return;
        }

        redis.zscore('marker_marks:' + uid, cid, function (err, res) {
          if (err) {
            done(err);
            return;
          }

          assert.strictEqual(res, null);
          done();
        });
      });
    });
  });


  it('.markAll() should update cut', function (done) {
    var uid = new ObjectId();
    var sid = new ObjectId();
    var now = Date.now();

    Marker.markAll(uid, sid, function (err) {
      if (err) {
        done(err);
        return;
      }

      redis.get('marker_cut:' + uid + ':' + sid, function (err, res) {
        if (err) {
          done(err);
          return;
        }

        assert.ok(now - 1000 <= res && res <= now + 1000);

        redis.zscore('marker_cut_updates', uid + ':' + sid, function (err, res) {
          if (err) {
            done(err);
            return;
          }

          assert.ok(now - 1000 <= res && res <= now + 1000);
          done();
        });
      });
    });
  });


  it('.setPos()', function (done) {
    var uid = new ObjectId();
    var cid = new ObjectId();
    var now = Date.now();

    Marker.setPos(uid, cid, 6, function (err) {
      if (err) {
        done(err);
        return;
      }

      Marker.setPos(uid, cid, 2, function (err) {
        if (err) {
          done(err);
          return;
        }

        redis.zscore('marker_pos_updates', uid + ':' + cid, function (err, res) {
          if (err) {
            done(err);
            return;
          }

          assert.ok(now - 1000 <= res && res <= now + 1000);

          redis.hget('marker_pos:' + uid, cid, function (err, resJson) {
            if (err) {
              done(err);
              return;
            }

            var res = JSON.parse(resJson);

            assert.equal(res.current, 2);
            assert.equal(res.max, 6);
            done();
          });
        });
      });
    });
  });


  it('.setPos() - limit position markers', function (done) {
    var uid = randObjectIdByTimestamp(Date.now());
    var query = redis.multi();

    for (var i = 0; i < 2000; i++) {
      query.hset('marker_pos:' + uid, i, JSON.stringify({}));
    }

    query.exec(function (err) {
      if (err) {
        done(err);
        return;
      }

      Marker.setPos(uid, 'qqq', 6, function (err) {
        if (err) {
          done(err);
          return;
        }

        redis.hlen('marker_pos:' + uid, function (err, cnt) {
          if (err) {
            done(err);
            return;
          }

          assert.equal(cnt, 1000);

          done();
        });
      });
    });
  });


  describe('.info()', function () {

    it('should set `isNew` flag correctly', function (done) {
      var uid = new ObjectId();
      var now = Date.now();

      var sid1 = randObjectIdByTimestamp(now);
      var sid2 = randObjectIdByTimestamp(now);

      var cid1 = randObjectIdByTimestamp(now);
      var cid2 = randObjectIdByTimestamp(now - expire - 1000);
      var cid3 = randObjectIdByTimestamp(now);
      var cid4 = randObjectIdByTimestamp(now);

      Marker.mark(uid, cid3, function (err) {
        if (err) {
          done(err);
          return;
        }

        Marker.info(uid, [
          { categoryId: sid1, contentId: cid1, lastPosition: 1 },
          { categoryId: sid1, contentId: cid2, lastPosition: 1 },
          { categoryId: sid1, contentId: cid3, lastPosition: 1 },
          { categoryId: sid2, contentId: cid4, lastPosition: 1 }
        ], function (err, res) {
          if (err) {
            done(err);
            return;
          }

          assert.ok(res[cid1].isNew);
          assert.ok(!res[cid2].isNew);
          assert.ok(!res[cid3].isNew);
          assert.ok(res[cid4].isNew);

          done();
        });
      });
    });


    it('should set correct position info', function (done) {
      var uid = new ObjectId();
      var now = Date.now();

      var sid = randObjectIdByTimestamp(now);
      var cid1 = randObjectIdByTimestamp(now);
      var cid2 = randObjectIdByTimestamp(now);
      var cid3 = randObjectIdByTimestamp(now);

      async.series([
        function (next) {
          Marker.setPos(uid, cid1, 11, next);
        },
        function (next) {
          Marker.setPos(uid, cid1, 7, next);
        },
        function (next) {
          Marker.setPos(uid, cid2, 3, next);
        },
        function (next) {
          Marker.setPos(uid, cid2, 35, next);
        },
        function (next) {
          Marker.setPos(uid, cid3, 3, next);
        },
        function (next) {
          Marker.setPos(uid, cid3, 35, next);
        },
        function (next) {
          Marker.info(uid, [
            { categoryId: sid, contentId: cid1, lastPosition: 11, lastPositionTs: now },
            { categoryId: sid, contentId: cid2, lastPosition: 77, lastPositionTs: now },
            { categoryId: sid, contentId: cid3, lastPosition: 77, lastPositionTs: now - expire - 1000 }
          ], function (err, res) {
            if (err) {
              next(err);
              return;
            }

            assert.equal(res[cid1].next, -1);
            assert.equal(res[cid1].position, 7);

            assert.equal(res[cid2].next, 36);
            assert.equal(res[cid2].position, 35);

            assert.equal(res[cid3].next, -1);
            assert.equal(res[cid3].position, 35);

            next();
          });
        }
      ], done);
    });
  });


  it('.cleanup()', function (done) {
    var now = Date.now();
    var uid = new ObjectId();

    var query = redis.multi();

    query.set('marker_cut:' + uid + ':abc', now);
    query.set('marker_cut:' + uid + ':bcd', now - expire - 1000);
    query.zadd('marker_cut_updates', now, uid + ':abc');
    query.zadd('marker_cut_updates', now - expire - 1000, uid + ':bcd');

    query.zadd('marker_marks:' + uid, now, 'qwe');
    query.zadd('marker_marks:' + uid, now - expire - 1000, 'ewq');
    query.sadd('marker_marks_items', uid);

    query.hset('marker_pos:' + uid, 'fgh', JSON.stringify({ max: 22, current: 11, ts: +now }));
    query.hset('marker_pos:' + uid, 'hgf', JSON.stringify({ max: 33, current: 15, ts: +now }));
    query.zadd('marker_pos_updates', now, uid + ':fgh');
    query.zadd('marker_pos_updates', now - expire - 1000, uid + ':hgf');

    query.exec(function (err) {
      if (err) {
        done(err);
        return;
      }

      Marker.cleanup(function (err) {
        if (err) {
          done(err);
          return;
        }

        setTimeout(function () {
          redis.multi()
              .get('marker_cut:' + uid + ':abc')
              .get('marker_cut:' + uid + ':bcd')
              .zscore('marker_cut_updates', uid + ':abc')
              .zscore('marker_cut_updates', uid + ':bcd')

              .zscore('marker_marks:' + uid, 'qwe')
              .zscore('marker_marks:' + uid, 'ewq')

              .hget('marker_pos:' + uid, 'fgh')
              .hget('marker_pos:' + uid, 'hgf')
              .zscore('marker_pos_updates', uid + ':fgh')
              .zscore('marker_pos_updates', uid + ':hgf')

              .exec(function (err, res) {

            if (err) {
              done(err);
              return;
            }

            assert.notEqual(res[0], null);
            assert.equal(res[1], null);
            assert.notEqual(res[2], null);
            assert.equal(res[3], null);

            assert.notEqual(res[4], null);
            assert.equal(res[5], null);

            assert.notEqual(res[6], null);
            assert.equal(res[7], null);
            assert.notEqual(res[8], null);
            assert.equal(res[9], null);

            done();
          });
        }, 100);
      });
    });
  });
});
