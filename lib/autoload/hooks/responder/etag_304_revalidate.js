// Add Etag header to each http and rpc response
//

'use strict';

const crypto = require('crypto');


module.exports = function (N) {
  N.wire.after([ 'responder:http', 'responder:rpc' ], { priority: 95 }, function etag_304_revalidate(env) {
    if (env.status !== 200) return;
    if (!env.body || typeof env.body !== 'string') return;
    if (env.headers['ETag'] || env.headers['Cache-Control']) return;

    let etag = '"' + crypto.createHash('sha1').update(env.body).digest('base64').substring(0, 27) + '"';

    env.headers['ETag'] = etag;
    env.headers['Cache-Control'] = 'must-revalidate';

    if (etag === env.origin.req.headers['if-none-match']) {
      env.status = N.io.NOT_MODIFIED;
      env.body = null;
    }
  });
};
