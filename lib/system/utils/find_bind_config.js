// Finds and caches the most appropriate bind config in by ApiPath.
//
// See `N.config.bind` for details.


'use strict';


var _ = require('lodash');


module.exports = _.memoize(function findBindConfig(N, apiPath) {
  var splitted = apiPath.split('.'), bind;

  // Reduce apiPath looking for matching binds.
  while (!_.isEmpty(splitted)) {
    bind = N.config.bind[splitted.join('.')];

    if (bind) {
      return bind; // Found.
    }

    splitted.pop();
  }

  return N.config.bind['default'] || null;
});
