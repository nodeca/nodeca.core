// Create N.broadcast to send messages between tabs.
// If not supported by browsers, calls are ignored silently.
'use strict';

N.wire.once('navigate.done', { priority: -900 }, function broadcast_init() {
  N.broadcast = {
    on: () => {},
    send: () => {}
  };

  if (typeof BroadcastChannel === 'undefined') return;

  const channels_out = Object.create(null);

  N.broadcast.on = (channel, handler) => {
    const bc = new BroadcastChannel(channel);
    bc.onmessage = event => {
      handler(event.data);
    };
  };

  N.broadcast.send = (channel, msg) => {
    if (!channels_out[channel]) {
      const bc = new BroadcastChannel(channel);
      channels_out[channel] = msg => bc.postMessage(msg);
    }

    channels_out[channel](msg);
  };
});
