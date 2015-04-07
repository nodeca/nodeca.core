'use strict';

var assert = require('assert');
var Queue  = require('nodeca.core/lib/queue');

describe('Queue', function () {
  this.timeout(5000);

  var q1, q2;

  before(function (done) {
    q1 = new Queue(TEST.N.redis);
    q2 = new Queue(TEST.N.redis);

    q1.on('error', function (err) {
      if (err === 'test err') {
        return;
      }
      throw err;
    });

    q2.on('error', function (err) {
      if (err === 'test err') {
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
      map: function (taskData, callback) {
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
      process: function (data, callback) {
        process1Chunks++;

        setTimeout(callback, 700); // check interval + max drift
      }
    };

    var worker2 = {
      name: 'test',
      chunksPerInstance: 2,
      map: function (taskData, callback) {
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
      process: function (data, callback) {
        process2Chunks++;

        setTimeout(callback, 700); // check interval + max drift
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
      map: function (taskData, callback) {
        assert.deepEqual(taskData, { taskDataTest1: 1, taskDataTest2: 2 });
        callback(null, [
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 },
          { chunkDataTest1: 1, chunkDataTest2: 2 }
        ]);
      },
      process: function (data, callback) {
        assert.deepEqual(data, { chunkDataTest1: 1, chunkDataTest2: 2 });
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
      retryDelay: 1, // 1 sec
      retry: 1,
      map: function (taskData, callback) {
        callback(null, [ 1, 2, 3 ]);
      },
      process: function (data, callback) {
        if (data === 2) {
          callback('test err');
          return;
        }

        callback(null, data);
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
      retryDelay: 1, // 1 sec
      retry: 1,
      map: function (taskData, callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        callback(null, data);
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
      retryDelay: 1, // 1 sec
      retry: 1,
      map: function (taskData, callback) {
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        callback(null, data);
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
      retryDelay: 1, // 1 sec
      retry: 1,
      map: function (taskData, callback) {
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        if (localCounter === 0) {
          callback('test err');
          localCounter++;
          return;
        }

        callback(null, data);
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
      timeout: 1,
      map: function (taskData, callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        callback(null, data);
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
      timeout: 1,
      map: function (taskData, callback) {
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        callback(null, data);
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
      timeout: 1,
      map: function (taskData, callback) {
        callback(null, [ 1 ]);
      },
      process: function (data, callback) {
        if (localCounter === 0) {
          localCounter++;
          // nothing to do
          return;
        }
        callback(null, data);
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
});
