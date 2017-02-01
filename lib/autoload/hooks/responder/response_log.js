// Log server response.
// Also write fatal errors details to system channel
//
'use strict';


const serialize = require('serialize-error');


module.exports = function (N) {

  N.wire.after([ 'responder:*' ], { priority: 101 }, function response_compress(env) {
    env.log_request(env);

    //
    // On fatal error write details to system logger
    //

    if (env.err_orig && env.err_orig instanceof Error) {
      let err = env.err_orig;

      let eData = serialize(err);
      delete eData.stack;

      let message;

      try {
        message = `***
ip:        ${env.req.ip}
url:       ${env.origin.req.url}
request:   ${env.origin.req.method}
responder: ${env.req.type}
apiPath:   ${env.method || '[unknown]'}
params:    ${JSON.stringify(env.params, null, '  ')}

stack: ${err.stack}

error: ${JSON.stringify(eData, null, '  ')}
***`;
      } catch (e) {
        message = e.stack;
      }

      N.logger.fatal(message);
    }
  });

};
