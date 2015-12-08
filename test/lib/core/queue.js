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
      if (err instanceof Queue.QueueError) {
        return;
      }
      throw err;
    });

    q2.on('error', function (err) {
      if (err instanceof Queue.QueueError) {
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

    q2.push('test', function (err) {
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

    q1.push('test2', { taskDataTest1: 1, taskDataTest2: 2 }, function (err) {
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

    q1.push('test3', {}, function (err) {
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

    q1.push('test4', {}, function (err) {
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

    q1.push('test5', {}, function (err) {
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

    q1.push('test6', {}, function (err) {
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

    q1.push('test7', {}, function (err) {
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

    q1.push('test8', {}, function (err) {
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

    q1.push('test9', {}, function (err) {
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
          q1.cancel('test10', this.task.id, function (err) {
            callback();
            done(err);
          });
        } else {
          throw new Error("process shouldn't be called second time");
        }
      }
    };

    q1.registerWorker(worker1);

    q1.push('test10', function (err) {
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
        q1.status('test11', this.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'mapping');

          callback(null, [ 1, 2, 3, 4 ]);
        });
      },
      reduce: function (chunksResult, callback) {
        q1.status('test11', this.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'reducing');

          callback();
          done();
        });
      },
      process: function (callback) {
        var self = this;

        q1.status('test11', self.task.id, function (err, data) {
          assert.ifError(err);
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'aggregating');

          assert.equal(data.chunks.pending.length, 4 - calls - 1);
          assert.equal(data.chunks.errored.length, 0);
          assert.equal(data.chunks.done.length,    calls);
          assert.equal(data.chunks.active.length,  1);
          assert.equal(data.chunks.active[0],      self.id);

          calls++;
          callback(null, self.data);
        });
      }
    };

    q1.registerWorker(worker1);

    q1.push('test11', function (err) {
      if (err) {
        throw err;
      }
    });
  });

  it("should return null if task doesn't exist", function (done) {
    q1.registerWorker({ name: 'test12' });

    q1.status('test12', 'non-existent-task', function (err, data) {
      assert.ifError(err);
      assert.strictEqual(data, null);

      done();
    });
  });

  it('worker instance should return correct taskID', function () {
    q1.registerWorker({ name: 'test13', taskID: (data) => data.foo + 'test' });

    assert.strictEqual(q1.worker('test13').taskID({ foo: 'bar' }), 'bartest');
  });
});
