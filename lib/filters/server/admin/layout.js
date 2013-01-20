'use strict';


/*global N*/


N.server.before('admin.**', function setLayout(env, next) {
  env.response.layout = ['admin', 'admin.base'];
  next();
});
