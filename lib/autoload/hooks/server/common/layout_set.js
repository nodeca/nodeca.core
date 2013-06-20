// Setup the common layout. It's less specific than the admin panel layout, so
// when handling admin panel methods, the layout will be overriden by
// `admin/layout_set.js` hook.

'use strict';


module.exports = function (N) {
  N.wire.before('server:**', { priority: -10 }, function layout_set(env, callback) {
    env.helpers.set_layout('common.layout');
    callback();
  });
};
