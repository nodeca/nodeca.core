'use strict';

/*global nodeca*/


module.exports = function (params, next) {
  this.response.data = {now: (new Date).toString()};
  next();
};


nodeca.filters.before('::admin', function (params, next) {
  console.log('before ::admin fired');

  if (0.5 < Math.random()) {
    next({denied: true});
    return;
  }

  next();
});

nodeca.filters.after('::admin', function (params, next) {
  console.log('after ::admin fired');
  next();
});

nodeca.filters.before('::admin.dashboard', function (params, next) {
  console.log('before ::admin.dashboard fired');
  next();
});

nodeca.filters.after('::admin.dashboard', function (params, next) {
  console.log('after ::admin.dashboard fired');
  next();
});

nodeca.filters.before('@', function (params, next) {
  console.log('before @ fired');
  next();
});

nodeca.filters.after('@', function (params, next) {
  console.log('after @ fired');
  next();
});
