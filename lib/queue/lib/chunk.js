// Chunk class
//
'use strict';

var thenify        = require('thenify');
var resolvePromise = require('./utils').resolvePromise;


function Chunk(id, data, task) {
  this.id   = id;
  this.task = task;
  this.data = data;
}


Chunk.prototype.process = thenify.withCallback(function (callback) {
  resolvePromise(this.task.worker.process.call(this), callback);
});


Chunk.prototype.setDeadline = thenify.withCallback(function (timeLeft, callback) {

  if (arguments.length === 0) {
    // `.setDeadline()`
    timeLeft = this.task.worker.timeout;

  } else if (arguments.length === 1 && !Number.isInteger(timeLeft)) {
    // `.setDeadline(callback)`
    callback = timeLeft;
    timeLeft = this.task.worker.timeout;
  }

  // else `.setDeadline(timeLeft)` or `.setDeadline(timeLeft, callback)`

  this.task.queue.__setChunkDeadline__(this, timeLeft, callback);
});


module.exports = Chunk;
