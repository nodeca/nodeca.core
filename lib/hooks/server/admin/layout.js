// Change default layout for admin panel
//

'use strict';



module.exports = function (N) {
  N.wire.before('server:admin.**', function setLayout(env, next) {
    env.response.layout = ['admin', 'admin.base'];
    next();
  });
};