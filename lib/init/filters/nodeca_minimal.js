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

  var assets = ['modernizr.custom.js', 'nodeca_minimal.js'];
  nodeca.runtime.assets.environment.precompile(assets, function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback({
      statusCode: 200,
      headers: {'Content-Type': 'text/html'},
      body:    nodeca.runtime.views['en-US'].desktop.layouts.minimal({
        loader_config: 'window.nodeca_init_config = ' + JSON.stringify([
          'views/en-US/desktop/layouts.js',
          'views/en-US/desktop/forum.js',
          'common/i18n/en-US.js',
          'common/app.js',
          'forum/i18n/en-US.js',
          'forum/app.js',
        ]),
        asset_include: function (path) {
          var asset = nodeca.runtime.assets.environment.findAsset(path);
          return !asset ? "" : asset.toString();
        }
      })
    });
  });
});


// added current route to response
nodeca.filters.before('', function(params, next) {
  this.response.data.head.route = this.request.method;
  next();
});
