// Initialize faye server for instant messaging
//
// Send message to channel:
//
//   N.live.emit('channel.name', { foo: bar });
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
var cookieParser = require('cookie');
var createToken  = require('nodeca.core/lib/random_token');
var codes        = require('nodeca.core/lib/system/io');
var http         = require('http');


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
            message.error = { code: codes.APP_ERROR, message: String(err.message || err) };
            callback(message);
            return;
          }

          if (!tokenExists) {
            // TODO: create new session and send new live token to client
            message.error = { code: codes.INVALID_LIVE_TOKEN };
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

          // Emit event for permission checker handler
          N.wire.emit(validatorName, data, function (err) {
            if (err) {
              message.error = err;
              callback(message);
              return;
            }

            if (!data.allowed) {
              message.error = { code: codes.FORBIDDEN, message: http.STATUS_CODES[codes.FORBIDDEN] };
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
        }
        // TODO: on, off
      };
    }

    fayeNodeAdapter.attach(server);
  });
};
