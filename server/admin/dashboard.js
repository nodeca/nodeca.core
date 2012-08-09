'use strict';


/**
 *  server
 **/

/**
 *  server.admin
 **/


/*global nodeca*/


// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 *  server.admin.dashboard(params, callback) -> Void
 *
 *  Administration dashboard
 **/
module.exports = function (params, next) {
  this.response.data.now = (new Date).toString();
  next();
};


// Examples of server filter hooks
// TODO: Remove them all


nodeca.filters.before('admin', function (params, next) {
  this.response.layout = 'admin';
  next();
});

nodeca.filters.before('admin', function (params, next) {
  console.log('before admin fired');
  next();
});

nodeca.filters.after('admin', function (params, next) {
  console.log('after admin fired');
  next();
});

nodeca.filters.before('admin.dashboard', function (params, next) {
  console.log('before admin.dashboard fired');
  next();
});

nodeca.filters.after('admin.dashboard', function (params, next) {
  console.log('after admin.dashboard fired');
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
