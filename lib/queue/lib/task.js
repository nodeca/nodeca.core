// Task class
//
'use strict';


function Task(id, data, worker, queue) {
  this.id     = id;
  this.data   = data;
  this.worker = worker;
  this.queue  = queue;
}


Task.prototype.map = function () {
  return this.worker.map.call(this);
};


Task.prototype.reduce = function (chunksResult) {
  return this.worker.reduce.call(this, chunksResult);
};


Task.prototype.setDeadline = function (timeLeft) {

  if (arguments.length === 0) {
    // `.setDeadline()`
    timeLeft = this.worker.timeout;
  }

  // else `.setDeadline(timeLeft)`

  return this.queue.__setTaskDeadline__(this, timeLeft);
};


module.exports = Task;
