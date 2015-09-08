// Task class
//
'use strict';


function Task(id, data, worker) {
  this.id     = id;
  this.data   = data;
  this.worker = worker;
}


Task.prototype.map = function (callback) {
  this.worker.map.call(this, callback);
};


Task.prototype.reduce = function (chunksResult, callback) {
  this.worker.reduce.call(this, chunksResult, callback);
};


module.exports = Task;
