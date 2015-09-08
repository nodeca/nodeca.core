// Worker class
//
'use strict';


var randomBytes  = require('crypto').randomBytes;


function Worker(options) {
  this.name = options.name;

  this.taskID = options.taskID || function () {
    return randomBytes(20).toString('hex');
  };

  this.chunksPerInstance = options.chunksPerInstance || Infinity;

  this.retry = options.retry || 2;
  this.retryDelay = options.retryDelay || 60000;

  this.timeout = options.timeout || 30000;

  this.cron = options.cron;

  this.map = options.map || function (callback) {
    callback(null, [ this.data ]);
  };

  this.process = options.process;

  this.reduce = options.reduce || function (chunksResult, callback) {
    callback();
  };

  this.chunksTracker = {};
}


module.exports = Worker;
