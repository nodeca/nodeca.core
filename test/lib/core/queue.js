'use strict';

const assert = require('assert');
const Queue  = require('nodeca.core/lib/queue');

describe('Queue', function () {
  let q1, q2;


  before(function (callback) {
    q1 = new Queue(TEST.N.config.database.redis);

    q1.start();

    q1.on('error', err => {
      if (err instanceof Queue.Error) return;
      throw err;
    });

    q1.on('connect', callback);
  });


  before(function (callback) {
    q2 = new Queue(TEST.N.config.database.redis);

    q2.start();

    q2.on('error', err => {
      if (err instanceof Queue.Error) return;
      throw err;
    });

    q2.on('connect', callback);
  });


  it('should correctly balance chunks for different instances', function (done) {
    let process1Chunks = 0;
    let process2Chunks = 0;

    let worker1 = {
      name: 'test',
      chunksPerInstance: 2,
      map(callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce(chunksResult, callback) {

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
      process(callback) {
        process1Chunks++;

        setTimeout(callback, 1000); // check interval + max drift
      }
    };

    let worker2 = {
      name: 'test',
      chunksPerInstance: 2,
      map(callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce(chunksResult, callback) {

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
      process(callback) {
        process2Chunks++;

        setTimeout(callback, 1000); // check interval + max drift
      }
    };

    q1.registerWorker(worker1);
    q2.registerWorker(worker2);

    q2.worker('test').push().catch(done);
  });


  it('should run `map`, `process` and `reduce` with correct data', function (done) {
    let worker = {
      name: 'test2',
      map(callback) {
        assert.deepEqual(this.data, { taskDataTest1: 1, taskDataTest2: 2 });
        callback(null, [
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 }
        ]);
      },
      process(callback) {
        assert.deepEqual(this.data, { chunkDataTest1: 1, chunkDataTest2: 2 });
        callback(null, { reduceDataTest1: 1, reduceDataTest2: 2 });
      },
      reduce(chunksResult, callback) {
        chunksResult.forEach(function (data) {
          assert.deepEqual(data, { reduceDataTest1: 1, reduceDataTest2: 2 });
        });

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test2').push({ taskDataTest1: 1, taskDataTest2: 2 }).catch(done);
  });


  it('should remove broken chunk', function (done) {
    let worker = {
      name: 'test3',
      retryDelay: 1, // 1 ms
      retry: 1,
      map(callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      process(callback) {
        if (this.data === 2) {
          callback('test err');
          return;
        }

        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
        assert.deepEqual(chunksResult.sort(), [ 1, 3 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test3').push({}).catch(done);
  });


  it('should restart once errored `map`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test4',
      retryDelay: 1, // 1 ms
      retry: 1,
      map(callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }
        callback(null, [ 1 ]);
      },
      process(callback) {
        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test4').push({}).catch(done);
  });


  it('should restart once errored `reduce`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test5',
      retryDelay: 1, // 1 ms
      retry: 1,
      map(callback) {
        callback(null, [ 1 ]);
      },
      process(callback) {
        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
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

    q1.worker('test5').push({}).catch(done);
  });


  it('should restart once errored `process`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test6',
      retryDelay: 1, // 1 ms
      retry: 1,
      map(callback) {
        callback(null, [ 1 ]);
      },
      process(callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }

        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test6').push({}).catch(done);
  });


  it('should restart once suspended `map`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test7',
      timeout: 10,
      map(callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, [ 1 ]);
      },
      process(callback) {
        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test7').push({}).catch(done);
  });


  it('should restart once suspended `reduce`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test8',
      timeout: 10,
      map(callback) {
        callback(null, [ 1 ]);
      },
      process(callback) {
        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
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

    q1.worker('test8').push({}).catch(done);
  });


  it('should restart once suspended `process`', function (done) {
    let localCounter = 0;

    let worker = {
      name: 'test9',
      timeout: 10,
      map(callback) {
        callback(null, [ 1 ]);
      },
      process(callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, this.data);
      },
      reduce(chunksResult, callback) {
        assert.deepEqual(chunksResult, [ 1 ]);

        done();
        callback();
      }
    };

    q1.registerWorker(worker);

    q1.worker('test9').push({}).catch(done);
  });


  it('should cancel a task', function (done) {
    let calls = 0;

    let worker1 = {
      name: 'test10',
      chunksPerInstance: 1,
      map(callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      reduce() {
        throw new Error("reduce shouldn't be called");
      },
      process() {
        if (calls++ === 0) {
          return this.task.worker.cancel(this.task.id).then(done);
        }

        throw new Error("process shouldn't be called second time");
      }
    };

    q1.registerWorker(worker1);

    q1.worker('test10').push().catch(done);
  });


  it('should return task status', function (done) {
    let calls = 0;

    let worker1 = {
      name: 'test11',
      chunksPerInstance: 1,
      map() {
        return this.worker.status(this.id).then(data => {
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'mapping');

          return [ 1, 2, 3, 4 ];
        });
      },
      process() {
        return this.task.worker.status(this.task.id).then(data => {
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'aggregating');

          assert.equal(data.chunks.pending, 4 - calls - 1);
          assert.equal(data.chunks.errored, 0);
          assert.equal(data.chunks.done,    calls);
          assert.equal(data.chunks.active,  1);
          // assert.equal(data.chunks.active[0],      this.id);

          calls++;
          return this.data;
        });
      },
      reduce() {
        return this.worker.status(this.id).then(data => {
          assert.equal(data.worker, 'test11');
          assert.equal(data.state,  'reducing');

          done();
        });
      }
    };

    q1.registerWorker(worker1);

    q1.worker('test11').push().catch(done);
  });


  it("should return null if task doesn't exist", function () {
    q1.registerWorker({ name: 'test12' });

    return q1.worker('test12').status('non-existent-task').then(data => {
      assert.strictEqual(data, null);
    });
  });


  it('worker instance should return correct taskID', function () {
    q1.registerWorker({ name: 'test13', taskID: data => data.foo + 'test' });

    assert.strictEqual(q1.worker('test13').taskID({ foo: 'bar' }), 'bartest');
  });


  describe('.postpone()', function () {
    it('should work with 1 argument', function (done) {
      let worker = {
        name: 'test14',
        postponeDelay: 1,
        process(cb) {
          cb();
        },
        reduce(__, cb) {
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test14').postpone().catch(done);
    });


    it('should work with delay argument', function (done) {
      let worker = {
        name: 'test15',
        postponeDelay: 1,
        process(cb) {
          cb(null, this.data);
        },
        reduce(res, cb) {
          assert.deepEqual(res, [ null ]);
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test15').postpone(2).catch(done);
    });


    it('should work with data argument', function (done) {
      let worker = {
        name: 'test16',
        postponeDelay: 1,
        process(cb) {
          cb(null, this.data);
        },
        reduce(res, cb) {
          assert.deepEqual(res, [ 'foo' ]);
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test16').postpone('foo').catch(done);
    });
  });


  describe('.setDeadline()', function () {
    it('task.setDeadline()', function (done) {
      let calls = 0;

      let worker = {
        name: 'test17',
        timeout: 1000000, // forever
        process(cb) {
          cb();
        },
        map(cb) {
          if (calls === 0) {
            calls++;
            this.setDeadline(10);
            return;
          }

          cb(null, [ 1 ]);
        },
        reduce(__, cb) {
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test17').push().catch(done);
    });


    it('chunk.setDeadline()', function (done) {
      let calls = 0;

      let worker = {
        name: 'test18',
        timeout: 1000000, // forever
        process(cb) {
          if (calls === 0) {
            calls++;
            this.setDeadline(10);
            return;
          }

          cb();
        },
        reduce(__, cb) {
          cb();
          done();
        }
      };

      q1.registerWorker(worker);

      q1.worker('test18').push().catch(done);
    });
  });


  it('should delete tasks for removed workers', function (done) {
    // Set startup time like a long time ago
    q1.__startup_time__ = 1000;

    // Create fake old worker record to awake garbage collector
    TEST.N.redis.zadd('queue:workers', 3000, 'test19', function (err) {
      if (err) {
        done(err);
      }
    });

    setTimeout(done, 1000); // check interval + max drift
  });
});
