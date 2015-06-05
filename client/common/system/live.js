// Add tabex client to 'N' as `live` and init faye client for instnt messaging
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
  var flive = tabex.client();

  var fayeClient = null;
  var trackedChannels = {};
  // TODO: update token
  var token = N.runtime.token_live;

  // Convert channel names to faye-compatible format: add '/' at start of
  // channel name and replace '.' with '!!'
  //
  flive.filterIn(function (channel, message, callback) {
    if (channel.indexOf('remote.') === 0) {
      callback('/' + channel.replace(/\./g, '!!'), message);
      return;
    }

    callback(channel, message);
  });

  // Resend local events with prefix `/remote!!` to server
  //
  flive.filterIn(function (channel, message, callback) {
    if (channel.indexOf('/remote!!') === 0) {
      // Make sure current tab is master
      if (fayeClient) {
        fayeClient.publish(channel, message.data);
      }

      return;
    }

    callback(channel, message);
  });

  // Convert channel name back from faye compatible format: remove '/'
  // at start of channel name and replace '!!' with '.'
  //
  flive.filterOut(function (channel, message, callback) {
    if (channel[0] === '/') {
      callback(channel.slice(1).replace(/!!/g, '.'), message);
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

  // If list of active channels changed - subscribe to new channels and
  // remove outdated ones.
  //
  flive.on('!sys.channels.refresh', function (data) {

    if (!fayeClient) {
      return;
    }

    // Filter channels by prefix `remote.`
    var channels = data.channels.filter(function (channel) {
      return channel.indexOf('remote.') === 0;
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
        trackedChannels[channel] = fayeClient.subscribe(
          '/' + channel.slice('remote.'.length).replace(/\./g, '!!'),
          function (message) {
            flive.emit(channel, message.data);
          }
        );
      }
    });
  });
});
