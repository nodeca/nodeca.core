// Chunk class
//
'use strict';


function Chunk(id, data, task) {
  this.id   = id;
  this.task = task;
  this.data = data;
}


Chunk.prototype.process = function (callback) {
  this.task.worker.process.call(this, callback);
};


Chunk.prototype.setDeadline = function (timeLeft, callback) {
  this.task.queue.__setChunkDeadline__(this.id, this.task.id, timeLeft, callback);
};


module.exports = Chunk;
