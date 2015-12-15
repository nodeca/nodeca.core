// Task class
//
'use strict';


function Task(id, data, worker, queue) {
  this.id     = id;
  this.data   = data;
  this.worker = worker;
  this.queue  = queue;
}


Task.prototype.map = function (callback) {
  this.worker.map.call(this, callback);
};


Task.prototype.reduce = function (chunksResult, callback) {
  this.worker.reduce.call(this, chunksResult, callback);
};


Task.prototype.setDeadline = function (timeLeft, callback) {
  this.queue.__setTaskDeadline__(this, timeLeft, callback);
};


module.exports = Task;
