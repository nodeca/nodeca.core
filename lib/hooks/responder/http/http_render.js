// Server-side renderer filter.
//


'use strict';


var _      = require('lodash');
var render = require('../../../system/render/common');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  // Filter middleware that renders view and required layout and sets
  //
  N.wire.after('responder:http', { priority: 10 }, function http_render(env) {

    // Don't render page on an error.
    if (env.err) {
      return;
    }

    var data = env.response.data
      , view = env.response.view || env.method;

    env.headers['Content-Type'] = 'text/html; charset=UTF-8';

    // If HEAD is requested, it's no need for real rendering.
    if ('HEAD' === env.origin.req.method) {
      env.body = null;
      return;
    }

    // Add more info and helpers to the template data.
    data = _.extend(data, env.helpers, {
      runtime: env.runtime
    , link_to: function link_to(name, params) {
        return N.runtime.router.linkTo(name, params) || '#';
      }
    , asset_include: function asset_include(path) {
        var asset  = N.runtime.assets.environment.findAsset(path)
          , result = '';

        if (asset) {
          try {
            result = asset.toString();

          } catch (err) {
            N.logger.error('Failed inline asset %s:\n%s'
            , path
            , err.stack || err.message || err
            );
          }
        }

        return result;
      }
    });

    // Start rendering.
    env.extras.puncher.start('Rendering');

    try {
      env.body = render(N.views, view, data);

      if (env.response.layout) {
        env.runtime.layout = env.response.layout;

        env.body = render(N.views, env.response.layout, _.extend(data, {
          content: env.body
        }));
      }
    } catch (err) {
      env.err = err;
    }

    env.extras.puncher.stop();
  });
};
