// Executes server chain

'use strict';


module.exports = function (N) {
  // Parse cookies
  //
  N.wire.on('responder:*', function server_chain(env, callback) {

    var channel_wildcard = 'server:' + env.method + ':*' // all responders
      , channel_strict = 'server:' + env.method + ':' + env.request.type
      , channel = null
      , validator;

    // Skip, if error happened at previous stage
    if (env.err) {
      callback();
      return;
    }

    // Quick-hack - search channel
    if (N.wire.has(channel_strict)) {
      channel = channel_strict;
    }
    if (N.wire.has(channel_wildcard)) {
      channel = channel_wildcard;
    }

    // No channel -> error
    if (!channel) {
      env.err = N.io.NOT_FOUND;
      callback();
      return;
    }

    //
    // Time to validate request
    //

    validator = N.validate.test(channel, env.params);

    // when method has no validation schema,
    // test() returns `null`, object with `valid` property otherwise
    if (!validator) {
      env.err = "Params schema is missing for " + env.method;
      callback();
      return;
    }

    if (!validator.valid) {
      // FIXME: do not list "bad" params on production?
      env.err = {
        code: N.io.BAD_REQUEST,
        message: "Invalid params:\n" + validator.errors.map(function (err) {
          return "- " + err.property + ' ' + err.message;
        }).join('\n')
      };
      callback();
      return;
    }

    // Now run server chain
    N.wire.emit(channel_strict, env, function (err) {
      // If server chain terminated - store error to format it later
      env.err = err;
      callback();
    });
  });
};