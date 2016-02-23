// Collect urls for sitemap
//
'use strict';


module.exports = function (N, apiPath) {

  // Initialize return value for data
  //
  N.wire.before(apiPath, { priority: -100 }, function init_sitemap_collect(locals) {
    locals.streams = locals.streams || [];
  });
};
