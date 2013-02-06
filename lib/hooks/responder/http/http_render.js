// server-side renderer filter
//


'use strict';


// 3rd-party
var _ = require('lodash');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  // Filter middleware that renders view and required layout and sets
  //
  N.wire.after('responder:http', { priority: 10 }, function http_render(env) {

    // Don't render page on error
    if (env.err) {
      return;
    }

    var data = env.response.data
      , layout = env.response.layout || 'default'
      , view = env.response.view || env.method;

    //
    // Expose layout into runtime
    //

    env.runtime.layout = layout;

    //
    // Set Content-Type and charset
    //

    env.headers['Content-Type'] = 'text/html; charset=UTF-8';

    //
    // HEAD requested - no need for real rendering
    //

    if ('HEAD' === env.origin.req.method) {
      env.body = null;
      return;
    }

    env.extras.puncher.start('Rendering');

    try {
      data = _.extend(data, {runtime: env.runtime});
      // Replace data object with rendered result (string)
      env.body = env.helpers.render(
        view,
        data,
        layout);

    } catch (err) {
      env.extras.puncher.stop();
      env.err = err;
      return;
    }
    env.extras.puncher.stop();
  });
};
