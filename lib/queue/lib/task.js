// Task class
//
'use strict';

var thenify           = require('thenify');
var promiseOrCallback = require('./utils').promiseOrCallback;


function Task(id, data, worker, queue) {
  this.id     = id;
  this.data   = data;
  this.worker = worker;
  this.queue  = queue;
}


Task.prototype.map = function (callback) {
  return promiseOrCallback(this.worker.map.call(this), callback);
};


Task.prototype.reduce = function (chunksResult, callback) {
  return promiseOrCallback(this.worker.reduce.call(this, chunksResult), callback);
};


Task.prototype.setDeadline = thenify.withCallback(function (timeLeft, callback) {

  if (arguments.length === 0) {
    // `.setDeadline()`
    timeLeft = this.worker.timeout;

  } else if (arguments.length === 1 && !Number.isInteger(timeLeft)) {
    // `.setDeadline(callback)`
    callback = timeLeft;
    timeLeft = this.worker.timeout;
  }

  // else `.setDeadline(timeLeft)` or `.setDeadline(timeLeft, callback)`

  this.queue.__setTaskDeadline__(this, timeLeft, callback);
});


module.exports = Task;
