// Executes a server method.


'use strict';


var format = require('util').format;


function invalidParamsInfo(errors) {

  var details = errors.map(function (err) {
    return format('- %s %s (%s)', err.field, err.message, err.value);
  });

  return [ 'Invalid params:' ].concat(details).join('\n');
}


module.exports = function (N) {
  N.wire.on('server_chain:*', function server_method_exec(env, callback) {
    var channel = 'server:' + env.method,
        validator;

    // No channel -> error
    if (!N.wire.has(channel)) {
      callback(N.io.NOT_FOUND);
      return;
    }

    // Time to validate the request.
    validator = N.validate.test(channel, env.params);

    // when method has no validation schema,
    // test() returns `null`, object with `valid` property otherwise
    if (!validator) {
      callback(format('Params validator not found for %s', env.method));
      return;
    }

    if (!validator.valid) {
      if (N.enviroment === 'development') {
        callback({ code: N.io.BAD_REQUEST, message: invalidParamsInfo(validator.errors) });
        return;
      }

      callback(N.io.BAD_REQUEST);
      return;
    }

    // Now run server method
    N.wire.emit(channel, env, callback);
  });
};
