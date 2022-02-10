// Inject http security headers into html pages
//

'use strict';


module.exports = function (N) {

  N.wire.after('responder:http', { priority: 15 }, function inject_csp_header(env) {

    // skip JSON requests
    if (env.origin.req.headers?.['x-requested-with'] === 'XMLHttpRequest') return;

    if (!/html/.test(env.headers['Content-Type'])) return;

    if (N.config?.options?.csp_header) {
      env.headers['Content-Security-Policy'] = N.config.options.csp_header.trim();
    }
  });
};
