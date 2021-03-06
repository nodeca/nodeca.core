// Add tabex client to 'N' as `live` and init faye client for instnt messaging.
// Prefix `local.` used to communicate between tabs without server
//
'use strict';


const tabex = require('tabex');
const faye  = require('faye/src/faye_browser');


// Emit event for connectors & add live instance to 'N' (after init `N.runtime`)
//
N.wire.once('navigate.done', { priority: -900 }, function live_init() {
  // Admin panel and user pages are in different scripts but
  // can bee opened in the same time. Need separate namespaces
  // to avoid collisions on server connections.
  let namespace =  (module.apiPath.split('.', 1)[0] === 'admin') ? 'admin' : 'frontend';

  // Init client for `N.live`
  N.live = tabex.client({ namespace });


  /////////////////////////////////////////////////////////////////////////////
  // Token update request
  //
  let lastRequest;

  N.live.on('local.common.core.token_live.update_request', function (requestID) {

    // Cancel last update request if runned
    if (lastRequest) {
      lastRequest.cancel();
    }

    // Run RPC request only in one client - lock by unique `requestID`
    N.live.lock('token_live_update_' + requestID, 5000, () => {
      // Promise returned from `N.io.rpc` have `.cancel()` method
      lastRequest = N.io.rpc('common.core.token_live', {}, { persistent: true });

      lastRequest
        .then(res => {
          // Send new token back
          N.live.emit('local.common.core.token_live.update_result', res.token_live);
        })
        .catch(err => {
          if (err.code === N.io.EWRONGVER) N.wire.emit('io.version_mismatch', err.hash);
          // Suppress other errors
        });
    });
  });


  /////////////////////////////////////////////////////////////////////////////
  // Init faye client
  //

  // Tabex client to communicate with faye
  let flive = tabex.client({ namespace });
  // Faye client to communicate with server
  let fayeClient = null;
  // Channels subscribed by faye
  let trackedChannels = {};
  // Token to validate connection
  let token = N.runtime.token_live;
  // Flag - waiting token update
  let tokenUpdateStarted = false;
  // Handlers subscribed to token update
  let updateHandlers = [];
  let updateTimeout = null;


  // Request update live token
  //
  // - callback (Function) - call after token update
  //
  function tokenUpdate(callback) {

    // Collect handlers who want update token
    if (callback) {
      updateHandlers.push(callback);
    }

    // If update already started - just wait for finish
    if (tokenUpdateStarted) return;

    // Mark update started
    tokenUpdateStarted = true;

    // Emit update request event to each tab with random ID for lock
    flive.emit('local.common.core.token_live.update_request', Math.round(Math.random() * 1e10));

    // If no response in 5 sec - allow retry
    updateTimeout = setTimeout(function () {
      tokenUpdateStarted = false;
    }, 5000);
  }

  // Handle token update result
  //
  flive.on('local.common.core.token_live.update_result', function (newToken) {
    let handlers = updateHandlers;

    // Update token locally
    token = newToken;
    updateHandlers = [];

    // Mark request stopped
    tokenUpdateStarted = false;
    clearTimeout(updateTimeout);

    // Notify handlers about update
    handlers.forEach(handler => handler());
  });


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
        if (err.message.code !== N.io.INVALID_LIVE_TOKEN) return;

        // `tokenUpdate` called here at second time (first in incoming faye filter).
        // It is needed to wait token update and retry after it
        tokenUpdate(() => {
          fayeClient.publish(toFayeCompatible(channel), message.data);
        });
      });

      return;
    }

    callback(channel, message);
  });


  function initFayeClient() {
    fayeClient = new faye.Client('/io/live');

    fayeClient.addExtension({
      outgoing(message, callback) {
        // If session is new & token does not exist, request a new one
        if (!token) {
          tokenUpdate(() => {
            message.token = token;
            callback(message);
          });
          return;
        }

        message.token = token;
        callback(message);
      },
      incoming(message, callback) {
        // If token error - request update
        if (message.error && message.error.code === N.io.INVALID_LIVE_TOKEN) {
          tokenUpdate();
        }

        callback(message);
      }
    });
  }


  // Connect to messaging server when become master and
  // kill connection if master changed
  //
  flive.on('!sys.master', function (data) {
    // If new master is in our tab - connect
    if (data.node_id === data.master_id) {
      if (!fayeClient) {
        initFayeClient();
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
    return fayeClient.subscribe(toFayeCompatible(channel), message => {
      flive.emit(channel, message);
    });
  }


  // If list of active channels changed - subscribe to new channels and
  // remove outdated ones.
  //
  flive.on('!sys.channels.refresh', function (data) {

    if (!fayeClient) return;

    // Filter channels by prefix `local.` and system channels (starts with `!sys.`)
    let channels = data.channels.filter(channel =>
      channel.indexOf('local.') !== 0 && channel.indexOf('!sys.') !== 0);


    // Unsubscribe removed channels
    //
    Object.keys(trackedChannels).forEach(channel => {
      if (channels.indexOf(channel) === -1) {
        trackedChannels[channel].cancel();
        delete trackedChannels[channel];
      }
    });


    // Subscribe to new channels
    //
    channels.forEach(channel => {
      if (!trackedChannels.hasOwnProperty(channel)) {
        trackedChannels[channel] = fayeSubscribe(channel);

        // If token invalid - update token and try subscribe again
        trackedChannels[channel].errback(err => {
          if (err.message.code !== N.io.INVALID_LIVE_TOKEN) return;

          // `tokenUpdate` called here at second time (first in incoming faye filter).
          // It is needed to wait token update and retry after it
          tokenUpdate(() => { trackedChannels[channel] = fayeSubscribe(channel); });
        });
      }
    });
  });


  // Handle server instance restart signal
  //
  N.live.on('common.core.reconnect', function reconnect() {
    // Only if tab contains `fayeClient` (master tab)
    if (!fayeClient) return;

    // Disconnect previous instance
    fayeClient.disconnect();
    fayeClient = null;

    // Init new instance
    initFayeClient();

    // Subscribe again to all previously subscribed channels
    Object.keys(trackedChannels).forEach(channel => {
      trackedChannels[channel] = fayeSubscribe(channel);

      // If token invalid - update token and try subscribe again
      trackedChannels[channel].errback(err => {
        if (err.message.code !== N.io.INVALID_LIVE_TOKEN) return;

        // `tokenUpdate` called here at second time (first in incoming faye filter).
        // It is needed to wait token update and retry after it
        tokenUpdate(() => { trackedChannels[channel] = fayeSubscribe(channel); });
      });
    });
  });
});
