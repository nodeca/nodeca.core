'use strict';

var assert = require('assert');
var Queue  = require('nodeca.core/lib/queue');

describe('Queue', function () {
  var q1, q2;

  before(function (done) {
    q1 = new Queue(TEST.N.redis);
    q2 = new Queue(TEST.N.redis);

    q1.start();
    q2.start();

    q1.on('error', function (err) {
      if (err instanceof Queue.Error) {
        return;
      }
      throw err;
    });

    q2.on('error', function (err) {
      if (err instanceof Queue.Error) {
        return;
      }
      throw err;
    });

    done();
  });

  it('should correctly balance chunks for different instances', function (done) {
    var process1Chunks = 0;
    var process2Chunks = 0;

    var worker1 = {
      name: 'test',
      chunksPerInstance: 2,
      map: function (callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce: function (chunksResult, callback) {

        if (process1Chunks > process2Chunks) {
          assert.equal(process1Chunks, 2);
          assert.equal(process2Chunks, 1);
        } else {
          assert.equal(process1Chunks, 1);
          assert.equal(process2Chunks, 2);
        }

        done();

        callback();
      },
      process: function (callback) {
        process1Chunks++;

        setTimeout(callback, 1000); // check interval + max drift
      }
    };

    var worker2 = {
      name: 'test',
      chunksPerInstance: 2,
      map: function (callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce: function (chunksResult, callback) {

        if (process1Chunks > process2Chunks) {
          assert.equal(process1Chunks, 2);
          assert.equal(process2Chunks, 1);
        } else {
          assert.equal(process1Chunks, 1);
          assert.equal(process2Chunks, 2);
        }

        done();

        callback();
      },
      process: function (callback) {
        process2Chunks++;

        setTimeout(callback, 1000); // check interval + max drift
      }
    };

    q1.registerWorker(worker1);
    q2.registerWorker(worker2);

    q2.worker('test').push(function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should run `map`, `process` and `reduce` with correct data', function (done) {
    var worker = {
      name: 'test2',
      map: function (callback) {
        assert.deepEqual(this.data, { taskDataTest1: 1, taskDataTest2: 2 });
        callback(null, [
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 }
        ]);
      },
      process: function (callback) {
        assert.deepEqual(this.data, { chunkDataTest1: 1, chunkDataTest2: 2 });
        callback(null, { reduceDataTest1: 1, reduceDataTest2: 2 });
      },
      reduce: function (chunksResult, callback) {
        chunksResult.forEach(function (data) {
          assert.deepEqual(data, { reduceDataTest1: 1, reduceDataTest2: 2 });
        });

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test2').push({ taskDataTest1: 1, taskDataTest2: 2 }, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should remove broken chunk', function (done) {
    var worker = {
      name: 'test3',
      retryDelay: 1, // 1 ms
      retry: 1,
      map: function (callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      process: function (callback) {
        if (this.data === 2) {
          callback('test err');
          return;
        }

        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        assert.deepEqual(chunksResult.sort(), [ 1, 3 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test3').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once errored `map`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test4',
      retryDelay: 1, // 1 ms
      retry: 1,
      map: function (callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test4').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once errored `reduce`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test5',
      retryDelay: 1, // 1 ms
      retry: 1,
      map: function (callback) {
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }

        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test5').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once errored `process`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test6',
      retryDelay: 1, // 1 ms
      retry: 1,
      map: function (callback) {
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }

        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test6').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once suspended `map`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test7',
      timeout: 10,
      map: function (callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test7').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once suspended `reduce`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test8',
      timeout: 10,
      map: function (callback) {
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }

        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test8').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should restart once suspended `process`', function (done) {
    var localCounter = 0;

    var worker = {
      name: 'test9',
      timeout: 10,
      map: function (callback) {
        callback(null, [ 1 ]);
      },
      process: function (callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, this.data);
      },
      reduce: function (chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test9').push({}, function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should cancel a task', function (done) {
    var calls = 0;

    var worker1 = {
      name: 'test10',
      chunksPerInstance: 1,
      map: function (callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce: function () {
        throw new Error("reduce shouldn't be called");
      },
      process: function (callback) {
        if (calls++ === 0) {
          this.task.worker.cancel(this.task.id, function (err) {
            callback();
            done(err);
          });
        } else {
          throw new Error("process shouldn't be called second time");
        }
      }
    };

    q1.registerWorker(worker1);

    q1.worker('test10').push(function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it('should return task status', function (done) {
    var calls = 0;

    var worker1 = {
      name: 'test11',
      chunksPerInstance: 1,
      map: function (callback) {
        this.worker.status(this.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'mapping');

          callback(null, [ 1, 2, 3, 4 ]);
        });
      },
      reduce: function (chunksResult, callback) {
        this.worker.status(this.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'reducing');

          callback();
          done();
        });
      },
      process: function (callback) {
        var self = this;

        this.task.worker.status(self.task.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'aggregating');

          assert.equal(data.chunks.pending, 4 - calls - 1);
          assert.equal(data.chunks.errored, 0);
          assert.equal(data.chunks.done,    calls);
          assert.equal(data.chunks.active,  1);
          // assert.equal(data.chunks.active[0],      self.id);

          calls++;
          callback(null, self.data);
        });
      }
    };

    q1.registerWorker(worker1);

    q1.worker('test11').push(function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it("should return null if task doesn't exist", function (done) {
    q1.registerWorker({ name: 'test12' });

    q1.worker('test12').status('non-existent-task', function (err, data) {
      assert.ifError(err);
      assert.strictEqual(data, null);

      done();
    });
  });

  it('worker instance should return correct taskID', function () {
    q1.registerWorker({ name: 'test13', taskID: (data) => data.foo + 'test' });

    assert.strictEqual(q1.worker('test13').taskID({ foo: 'bar' }), 'bartest');
  });

  describe('.postpone()', function () {

    it('should works with 1 argument', function (done) {
      var worker = {
        name: 'test14',
        postponeDelay: 1,
        process: function (cb) {
          cb();
        },
        reduce: function (__, cb) {
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test14').postpone(function (err) {
        assert.ifError(err);
      });
    });

    it('should works with delay argument', function (done) {
      var worker = {
        name: 'test15',
        postponeDelay: 1,
        process: function (cb) {
          cb(null, this.data);
        },
        reduce: function (res, cb) {
          assert.deepEqual(res, [ null ]);
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test15').postpone(2, function (err) {
        assert.ifError(err);
      });
    });

    it('should works with data argument', function (done) {
      var worker = {
        name: 'test16',
        postponeDelay: 1,
        process: function (cb) {
          cb(null, this.data);
        },
        reduce: function (res, cb) {
          assert.deepEqual(res, [ 'foo' ]);
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test16').postpone('foo', function (err) {
        assert.ifError(err);
      });
    });
  });
});
