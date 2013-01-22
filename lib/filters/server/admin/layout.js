'use strict';


/*global N*/


N.wire.before('server:admin.**', function setLayout(env, next) {
  env.response.layout = ['admin', 'admin.base'];
  next();
});
