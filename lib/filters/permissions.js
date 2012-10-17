'use strict';


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', { weight: 99 }, function fetch_permissions(params, callback) {
  var env   = this;
  var keys  = nodeca.permissions.getRequiredKeys(env.request.method);

  nodeca.permissions.fetch(keys, env.permissions.params, function (err, data) {
    env.data.permissions = data;
    callback(err);
  });
});
