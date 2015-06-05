// Add tabex client to 'N' as `live` and init faye client for instnt messaging.
// Prefix `local.` used to communicate between tabs without server
//
'use strict';


var tabex = require('tabex');
var faye = require('faye/browser/faye-browser');


// Emit event for connectors & add live instance to 'N' (after init `N.runtime`)
//
N.wire.once('navigate.done', { priority: -900 }, function live_init(__, callback) {

  // Init client for `N.live`
  N.live = tabex.client();


  /////////////////////////////////////////////////////////////////////////////
  // Init faye client
  //

  // Tabex client to communicate with faye
  var flive = tabex.client();
  // Faye client to communicate with server
  var fayeClient = null;
  // Channels subscribed by faye
  var trackedChannels = {};
  // Token to validate connection
  var token = N.runtime.token_live;
  // Flag - waiting token update
  var tokenUpdateStarted = false;
  // Handlers subscribed to token update
  var updateHandlers = [];


  // Update live token
  //
  // - callback (Function) - call after token update
  //
  function tokenUpdate(callback) {

    // Collect handlers who want update token
    if (callback) {
      updateHandlers.push(callback);
    }

    // If update already started - just wait for finish
    if (tokenUpdateStarted) {
      return;
    }

    // Mark update started
    tokenUpdateStarted = true;

    // Make RPC request to get new token
    N.io.rpc('common.core.token_live')
      .done(function (res) {
        var handlers = updateHandlers;

        token = res.token_live;
        updateHandlers = [];

        // Notify handlers about update
        handlers.forEach(function (handler) {
          handler();
        });
      })
      .finish(function () {
        tokenUpdateStarted = false;
      });
  }


  // Convert channel names to faye-compatible format: add '/' at start of
  // channel name and replace '.' with '!!'
  //
  function toFayeCompatible(ch) {
    return '/' + ch.replace(/\./g, '!!');
  }


  // Resend events to server (except prefix `local.` and `!sys.`)
  //
  flive.filterIn(function (channel, message, callback) {
    if (fayeClient && channel.indexOf('local.') !== 0 && channel.indexOf('!sys.') !== 0) {

      fayeClient.publish(toFayeCompatible(channel), message.data).then(function () {}, function (err) {

        // If token is invalid - request new and try one more time
        if (err.message.code !== N.io.INVALID_LIVE_TOKEN) {
          return;
        }

        // `tokenUpdate` called here at second time (first in incoming faye filter).
        // It is needed to wait token update and retry after it
        tokenUpdate(function () {
          fayeClient.publish(toFayeCompatible(channel), message.data);
        });
      });

      return;
    }

    callback(channel, message);
  });


  // Connect to messaging server when become master and
  // kill connection if master changed
  //
  flive.on('!sys.master', function (data) {
    // If new master is in our tab - connect
    if (data.node_id === data.master_id) {
      if (!fayeClient) {
        fayeClient = new faye.Client('/io/live');

        fayeClient.addExtension({
          outgoing: function (message, callback) {
            message.token = token;
            callback(message);
          },
          incoming: function (message, callback) {
            // If token error - request update
            if (message.error && message.error.code === N.io.INVALID_LIVE_TOKEN) {
              tokenUpdate();
            }

            callback(message);
          }
        });
      }
      return;
    }

    // If new master is in another tab - make sure to destroy zombie connection.
    if (fayeClient) {
      fayeClient.disconnect();
      fayeClient = null;
      trackedChannels = {};
    }
  });


  // Subscribe faye client to chennel and return subscription object
  //
  function fayeSubscribe(channel) {
    return fayeClient.subscribe(toFayeCompatible(channel), function (message) {
      flive.emit(channel, message.data);
    });
  }


  // If list of active channels changed - subscribe to new channels and
  // remove outdated ones.
  //
  flive.on('!sys.channels.refresh', function (data) {

    if (!fayeClient) {
      return;
    }

    // Filter channels by prefix `local.` and system channels (starts with `!sys.`)
    var channels = data.channels.filter(function (channel) {
      return channel.indexOf('local.') !== 0 && channel.indexOf('!sys.') !== 0;
    });


    // Unsubscribe removed channels
    //
    Object.keys(trackedChannels).forEach(function (channel) {
      if (channels.indexOf(channel) === -1) {
        trackedChannels[channel].cancel();
        delete trackedChannels[channel];
      }
    });


    // Subscribe to new channels
    //
    channels.forEach(function (channel) {
      if (!trackedChannels.hasOwnProperty(channel)) {
        trackedChannels[channel] = fayeSubscribe(channel);

        // If token invalid - update token and try subscribe again
        trackedChannels[channel].errback(function (err) {
          if (err.message.code !== N.io.INVALID_LIVE_TOKEN) {
            return;
          }

          // `tokenUpdate` called here at second time (first in incoming faye filter).
          // It is needed to wait token update and retry after it
          tokenUpdate(function () {
            trackedChannels[channel] = fayeSubscribe(channel);
          });
        });
      }
    });
  });
});
