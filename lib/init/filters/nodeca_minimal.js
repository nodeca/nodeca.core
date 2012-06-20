'use strict';


/*global nodeca*/


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', {weight: 50}, function nodeca_minimal(params, callback) {
  // skip non-http requests
  if (!this.origin.http) {
    callback(null);
    return;
  }

  // TEMPORARILY -- minimal loader is sent only upon specific request
  if (!this.origin.http.req.query['minimal']) {
    callback(null);
    return;
  }

  this.extras.assets.includeJavascript('nodeca_init.js');

  this.extras.assets.precompile(function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback({
      statusCode: 200,
      headers: {'Content-Type': 'text/html'},
      body: '<html><head></head><body>Hi!</body></html>'
    });
  });
});


nodeca.filters.after('', {weight: 50}, function precompile_required_assets(params, callback) {
  this.extras.assets.precompile(callback);
});
