// Initialize faye server for instant messaging
//
// Send message to channel:
//
// - `N.live.emit('channel.name', { foo: bar });`
// - `N.live.debounce('channel.name', { foo: bar });` - filer messages via deboncer (1 sec) and send then
//
// Сheck subscribe permission:
//
//   N.wire.on('internal.live.subscribe:channel.name', function (data, callback) {
//     if (permissions) {
//       data.allowed = true;
//     }
//
//     callback();
//   });
//
// Сheck posting permission:
//
//   N.wire.on('internal.live.post:channel.name', function (data, callback) {
//     if (permissions) {
//       data.allowed = true;
//     }
//
//     callback();
//   });
//
// data:
//
// - allowed
// - message
// - channel
//
'use strict';


var faye         = require('faye');
var deflate      = require('permessage-deflate');
var fayeRedis    = require('faye-redis');
var redisUrl     = require('redis-url');
var createToken  = require('nodeca.core/lib/random_token');


// Set limit of 100KB for messages sended through websocket.
// https://github.com/faye/faye/issues/386
//
var driver = require('faye/node_modules/faye-websocket/node_modules/websocket-driver/lib/websocket/driver/base');
driver.prototype.MAX_LENGTH = 100 * 1024;


module.exports = function (N) {

  // Key to validate messages from server
  var serverSecretKey = createToken();
  // Faye instance
  var fayeNodeAdapter = null;


  function normalizeError(err) {
    // Extend sugared errors
    // Example: next(404);
    if (err === +err) {
      err = { code: err };
    }

    if (err.code) {
      return err;
    }

    // Still no code -> we got Error object or string
    // Example: next(new Error('Fatal fuckup'))
    var e = {
      code: N.io.APP_ERROR
    };

    // Add message if required
    if (N.environment === 'development') {
      e.message = '[500] ' + (err.stack || err.message || err.toString());
    }

    return e;
  }


  // Init Faye instance
  //
  function initFaye() {
    // Parse redis url
    var redisConfig = redisUrl.parse((N.config.database || {}).redis);

    // Init adapter
    var bayeux = new faye.NodeAdapter({
      mount: '/io/live',
      timeout: 10000,
      ping: 25000,
      engine: {
        type: fayeRedis,
        host: redisConfig.hostname,
        port: redisConfig.port,
        password: redisConfig.password,
        database: redisConfig.database,
        namespace: 'nodeca'
      }
    });

    // Add WebSocket server
    bayeux.addWebsocketExtension(deflate);

    var allowedSystemChannels = [
      '/meta/handshake',
      '/meta/connect',
      '/meta/unsubscribe',
      '/meta/disconnect'
    ];

    bayeux.addExtension({
      incoming: function (message, request, callback) {

        // If message sent by server - skip other checks
        if (message.key === serverSecretKey) {
          delete message.key;
          callback(message);
          return;
        }

        // Check auth token (client should send it in every message)
        N.redis.exists('token_live:' + message.token, function (err, tokenExists) {
          if (err) {
            message.error = normalizeError(err);
            callback(message);
            return;
          }

          if (!tokenExists) {
            // We cannot automatically create new session because here we can't set cookies
            message.error = normalizeError(N.io.INVALID_LIVE_TOKEN);
            callback(message);
            return;
          }

          // Allow system channels
          if (allowedSystemChannels.indexOf(message.channel) !== -1) {
            callback(message);
            return;
          }

          var data = {
            message: message,
            allowed: false,
            channel: null
          };

          var validatorName;

          // If client want subscribe to channel
          if (message.channel === '/meta/subscribe') {
            // Convert channel name back from faye compatible format: remove '/'
            // at start of channel name and replace '!!' with '.'
            data.channel = message.subscription.slice(1).replace(/!!/g, '.');

            validatorName = 'internal.live.subscribe:' + data.channel;

          // If client want emit message
          } else {
            // Convert channel name back from faye compatible format: remove '/'
            // at start of channel name and replace '!!' with '.'
            data.channel = message.channel.slice(1).replace(/!!/g, '.');

            validatorName = 'internal.live.post:' + data.channel;
          }

          // Don't allow empty channels & wildcards
          if (!data.channel || data.channel.indexOf('*') !== -1) {
            message.error = normalizeError(N.io.FORBIDDEN);
            callback(message);
            return;
          }

          // Emit event for permission checker handler
          N.wire.emit(validatorName, data, function (err) {
            if (err) {
              message.error = normalizeError(err);
              callback(message);
              return;
            }

            if (!data.allowed) {
              message.error = normalizeError(N.io.FORBIDDEN);
              callback(message);
              return;
            }

            callback(message);
          });
        });
      }
    });

    return bayeux;
  }


  /////////////////////////////////////////////////////////////////////////////
  // Debounced emit.
  //
  // In redis:
  //
  // - `live_debounce:<channel_name>` (zset)
  //   - score - timestamp
  //   - member - stringified data
  // - `live_debounce_last` (zset)
  //   - score - last send ts
  //   - member - channel name
  //


  const WAIT = 1000;


  // Redis time to milliseconds
  //
  function redisToMs(time) {
    // Redis reply containing two elements: unix time in seconds, microseconds
    return time[0] * 1000 + Math.round(time[1] / 1000);
  }


  var debounceTimerId = null;


  function debounceTick() {
    N.redis.time(function (err, time) {
      if (err) {
        // Don't need log errors here
        return;
      }

      time = redisToMs(time);

      N.redis.multi()
          // Remove old records
          .zremrangebyscore('live_debounce_last', 0, time - WAIT * 2)
          .zrangebyscore('live_debounce_last', '-inf', time - WAIT)
          .exec(function (err, data) {

        if (err) {
          // Don't need log errors here
          return;
        }

        var multi = N.redis.multi();

        data[1].forEach(function (channel) {
          multi
            // Echo channel name for iterator
            .echo(channel)
            // Get last message
            .zrange('live_debounce:' + channel, -1, -1)
            // Cleanup messages collection
            .zremrangebyrank('live_debounce:' + channel, 0, -1)
            // Update last send ts
            .zadd('live_debounce_last', time, channel);
        });

        multi.exec(function (err, data) {
          if (err) {
            // Don't need log errors here
            return;
          }

          var msg, channel;

          for (var i = 0; i < data.length; i += 4) {
            channel = data[i];
            msg = data[i + 1][0] || null;

            if (!msg) {
              continue;
            }

            try {
              msg = JSON.parse(msg);
            } catch (__) {
              continue;
            }

            N.live.emit(channel, msg);
          }
        });
      });
    });
  }


  function debounce(channel, data) {
    N.redis.time(function (err, time) {
      if (err) {
        // Don't need log errors here
        return;
      }

      // TTL for redis collections: WAIT * 2 in seconds
      var ttl = Math.round(WAIT * 2 / 1000);

      N.redis.multi()
          .zadd('live_debounce:' + channel, redisToMs(time), JSON.stringify(data))
          // If last send ts does not exists - create it. Init with -1, to avoid
          // GC conflict (GC clears 0+ interval).
          .zadd('live_debounce_last', 'NX', -1, channel)
          .expire('live_debounce:' + channel, ttl)
          .expire('live_debounce_last', ttl)
          .exec(function (err) {
        if (err) {
          // Don't need log errors here
          return;
        }

        // Lazy init ticker on first coming data
        if (!debounceTimerId) {
          debounceTimerId = setInterval(debounceTick, 500);
          debounceTick();
        }
      });
    });
  }


  /////////////////////////////////////////////////////////////////////////////
  // Init faye and attach it to server (this event fires for each binding)
  //
  N.wire.on([ 'init:server.http', 'init:server.https' ], function faye_init(server) {

    if (!fayeNodeAdapter) {
      fayeNodeAdapter = initFaye();
    }

    // Create `N.live` if not exists
    if (!N.live) {
      var client = fayeNodeAdapter.getClient();

      client.addExtension({
        // Append key for each message sended from server
        outgoing: function (message, callback) {
          message.key = serverSecretKey;
          callback(message);
        }
      });

      // Add wrapper for faye client
      N.live = {
        emit: function (channel, data) {
          // Convert channel name to faye compatible format: add '/' at start of
          // channel name and replace '.' with '!!'
          channel = (channel[0] === '/' ? channel : '/' + channel).replace(/\./g, '!!');
          client.publish(channel, data);
        },
        debounce: debounce
        // TODO: on, off
      };
    }

    fayeNodeAdapter.attach(server);
  });
};
