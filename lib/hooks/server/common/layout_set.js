// Setup the common layout. It's less specific than the admin panel layout, so
// when handling admin panel methods, the layout will be overriden by
// `admin/layout_set.js` hook.

'use strict';


module.exports = function (N) {
  N.wire.before('server:**', function setLayout(env, callback) {
    env.response.layout = 'common.layout';
    callback();
  });
};
