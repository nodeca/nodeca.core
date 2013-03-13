// Change default layout for admin panel
//

'use strict';


module.exports = function (N) {
  N.wire.before('server:admin.**', { priority: -9 }, function setLayout(env, callback) {
    env.response.layout = 'admin.layout';
    callback();
  });
};
