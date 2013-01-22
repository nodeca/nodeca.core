// server-side renderer filter
//


'use strict';


/*global N*/


// 3rd-party
var _ = require('underscore');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  // Filter middleware that renders view and required layout and sets
  //
  // - `response.headers` with approprite headers
  // - `response.body` with rendered (and compressed if allowed) html
  //
  N.wire.after('server:**', { priority: 85 }, function renderer(env, callback) {
    var http, headers, layout;

    if (!env.origin.http) {
      // skip non-http requests
      callback();
      return;
    }

    http    = env.origin.http,
    headers = env.response.headers,
    layout  = env.response.layout;

    //
    // Expose layout into runtime
    //

    env.runtime.layout = layout;

    //
    // Set Content-Type and charset
    //

    headers['Content-Type'] = 'text/html; charset=UTF-8';

    //
    // 304 Not Modified
    //

    if (headers['ETag'] && headers['ETag'] === http.req.headers['if-none-match']) {
      // The one who sets `ETag` header must set also (by it's own):
      //  - `Last-Modified`
      //  - `Cache-Control`
      env.response.statusCode = 304;
      callback();
      return;
    }

    //
    // HEAD requested - no need for real rendering
    //

    if ('HEAD' === http.req.method) {
      callback();
      return;
    }

    env.extras.puncher.start('Rendering');

    try {
      env.response.data = _.extend(env.response.data, {runtime: env.runtime});
      env.response.body = env.helpers.render(
        env.response.view, env.response.data, layout);
    } catch (err) {
      env.extras.puncher.stop();
      callback(err);
      return;
    }

    env.extras.puncher.stop();
    callback();
  });

};
