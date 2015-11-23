// Injection for in-place error display on navigation problems
//
'use strict';

N.wire.on('navigate.error', function error(data) {
  data.apiPath = data.view = module.apiPath;
});
