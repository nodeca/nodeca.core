// Check access by url
//
// In:
//
// - params.url - content url
// - params.user_info - user id or Object
//
// Out:
//
// - data.access_read - boolean access
//
// Implementations of `internal:common.access`:
//
// - internal:forum.access.post
// - internal:forum.access.section
// - ...
//
'use strict';


module.exports = function (N, apiPath) {

  // Initialize return value for data
  //
  N.wire.before(apiPath, { priority: -100 }, function init_access_env(locals) {
    locals.data = locals.data || {};
  });
};
