// Change default layout for admin panel
//

'use strict';


module.exports = function (N) {
  N.wire.before('server:admin.*', { priority: -5 }, function layout_set(env, callback) {
    env.helpers.set_layout('admin.core.layout');
    callback();
  });
};
