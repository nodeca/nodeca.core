'use strict';


var nodeca = global.nodeca;


module.exports = function (params, next) {
  this.response.data = {now: (new Date).toString()};
  next();
};


nodeca.filters.before('::admin', function (params, next) {
  console.log('::admin fired');
  next();
});

nodeca.filters.before('::admin.dashboard', function (params, next) {
  console.log('::admin.dashboard fired');
  next();
});

nodeca.filters.before('@', function (params, next) {
  console.log('@ fired');
  next();
});
