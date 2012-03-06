'use strict';


module.exports = function (params, next) {
  this.data = {now: (new Date).toString()};
  next();
};
