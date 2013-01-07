'use strict';


/*global N*/


N.filters.before('admin', function setLayout(params, next) {
  this.response.layout = 'admin.base';
  next();
});
