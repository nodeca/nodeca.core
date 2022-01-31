// Interface for server push notifications
//
'use strict';


const faye  = require('faye/src/faye_browser');
const EE = require('events');

// Emit event for connectors & add live instance to 'N' (after init `N.runtime`)
//
N.wire.once('navigate.done', { priority: -900 }, function live_init() {

  let token = null;

  async function token_update() {
    token = null;

    // Pause to avoid ddos on error
    await new Promise(r => setTimeout(r, 500));

    try {
      const res = await N.io.rpc('common.core.token_live', {}, { persistent: true });
      token = res.token_live;
    } catch (err) {
      // Suppress errors except reload requests
      if (err.code === N.io.EWRONGVER) N.wire.emit('io.version_mismatch', err.hash);
    }
  }

  class FLive {
    constructor() {
      this.emitter = new EE();
      this.trackedChannels = Object.create(null);
      this.fayeClient = null;
    }

    // Convert channel names to faye-compatible format: add '/' at start of
    // channel name and replace '.' with '!!'
    toFayeCompatible(ch) {
      return '/' + ch.replace(/\./g, '!!');
    }

    init() {
      this.fayeClient = new faye.Client('/io/live');

      this.fayeClient.addExtension({
        outgoing(message, callback) {
          // If session is new & token does not exist, request a new one
          if (!token) {
            token_update().then(() => {
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
          if (message.error?.code === N.io.INVALID_LIVE_TOKEN) {
            token_update().then(() => { callback(message); });
            return;
          }

          callback(message);
        }
      });
    }

    on(channel, handler) {
      this.emitter.on(channel, handler);

      this.trackedChannels[channel] = this.fayeClient.subscribe(
        this.toFayeCompatible(channel),
        msg => { this.emitter.emit(channel, msg); }
      );
    }

    off(channel, handler) {
      if (this.trackedChannels[channel]) {
        this.trackedChannels[channel].cancel();
        delete this.trackedChannels[channel];
      }
      this.emitter.off(channel, handler);
    }

    emit(channel, message) {
      if (!this.fayeClient) return Promise.resolve;

      this.fayeClient.publish(this.toFayeCompatible(channel), message)
        .then(
          () => {},
          err => {
            // If token is invalid - request new and try one more time
            if (err.message.code !== N.io.INVALID_LIVE_TOKEN) return;

            return token_update(() => {
              this.fayeClient.publish(this.toFayeCompatible(channel), message.data);
            });
          }
        );
    }
  }

  // Init client for `N.live`
  N.live = new FLive();

  N.live.init();


  // TODO: Handle server instance restart signal
  //
  N.live.on('common.core.reconnect', function reconnect() {
  });
});
