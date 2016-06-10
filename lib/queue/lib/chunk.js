// Chunk class
//
'use strict';


function Chunk(id, data, task) {
  this.id   = id;
  this.task = task;
  this.data = data;
}


Chunk.prototype.process = function () {
  return this.task.worker.process.call(this);
};


Chunk.prototype.setDeadline = function (timeLeft) {

  if (arguments.length === 0) {
    // `.setDeadline()`
    timeLeft = this.task.worker.timeout;
  }

  // else `.setDeadline(timeLeft)`

  return this.task.queue.__setChunkDeadline__(this, timeLeft);
};


module.exports = Chunk;
