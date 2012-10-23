'use strict';


/*global nodeca*/


nodeca.filters.before('admin', function setLayout(params, next) {
  this.response.layout = 'admin';
  next();
});
