// Log server response.
// Also write fatal errors details to system channel
//
'use strict';

module.exports = function (N) {

  N.wire.after([ 'responder:*' ], { priority: 101 }, function response_compress(env) {
    env.log_request(env);

    if (env.err_orig && env.err_orig instanceof Error) {
      let err = env.err_orig;

      N.logger.fatal('%s', err.stack || err.message || err.toString());
    }
  });

};
