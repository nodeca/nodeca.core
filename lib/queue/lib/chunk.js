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


module.exports = Chunk;
