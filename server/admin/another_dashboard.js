'use strict';


var nodeca = global.nodeca;


module.exports = function (params, next) {
  this.response.data = {now: (new Date).toString()};
  this.response.view = 'dashboard';
  next();
};


nodeca.filters.before('::admin', function (params, next) {
  console.log('before ::admin fired');
  next();
});

nodeca.filters.after('::admin', function (params, next) {
  console.log('after ::admin fired');
  next();
});

nodeca.filters.before('::admin.anotherDashboard', function (params, next) {
  console.log('before ::admin.anotherDashboard fired');
  next();
});

nodeca.filters.after('::admin.anotherDashboard', function (params, next) {
  console.log('after ::admin.anotherDashboard fired');
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
