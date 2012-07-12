"use strict";


/*global nodeca, _*/


// stdlib
var path = require('path');


// nodeca
var HashTree  = require('nlib').Support.HashTree;
var JASON     = require('nlib').Vendor.JASON;


// 3rd-party
var Faye      = require('faye');


// internal
var env = require('../../env');


////////////////////////////////////////////////////////////////////////////////


var realtime = module.exports = {
  activeClients: 0
};


////////////////////////////////////////////////////////////////////////////////


var noop = function () {};


// FAYE EXTENSIONS /////////////////////////////////////////////////////////////


function add_subscription_filter(bayeux, whitelist) {
  bayeux.addExtension({
    incoming: function (message, callback) {
      var allow;

      // allow any message from the server client
      if (bayeux.getClient().getClientId() === message.clientId) {
        callback(message);
        return;
      }

      // allow any non-subscription message
      if (!message.subscription) {
        callback(message);
        return;
      }

      allow = _.any(whitelist, function (re) {
        return re.test(message.subscription);
      });

      // subscription channel is in whitelist
      if (allow) {
        callback(message);
        return;
      }

      nodeca.logger.warn("Subscription denied: " + message.subscription);

      message.error = "Subscription Denied";
      callback(message);
    }
  });
}


function add_publishing_filter(bayeux, whitelist) {
  bayeux.addExtension({
    incoming: function (message, callback) {
      var allow;

      // allow any message from the server client
      if (bayeux.getClient().getClientId() === message.clientId) {
        callback(message);
        return;
      }

      // allow any special-case messages
      if ('/meta/' === message.channel.substr(0, 6)) {
        callback(message);
        return;
      }

      allow = _.any(whitelist, function (re) {
        return re.test(message.channel);
      });

      // subscription channel is in whitelist
      if (allow) {
        callback(message);
        return;
      }

      nodeca.logger.warn("Publishing denied: " + JSON.stringify({
        channel:  message.channel,
        clientId: message.clientId
      }));

      message.error = "Publishing Denied";
      callback(message);
    }
  });
}


////////////////////////////////////////////////////////////////////////////////


function handle_rpc(msg, cb) {
  var fn = HashTree.get(nodeca.server, msg.method);

  nodeca.debug_trace('handle_rpc()', msg);

  if (msg.version !== nodeca.runtime.version) {
    (cb || noop)({
      version:  nodeca.runtime.version,
      error:    'Nodeca client mismatch'
    });
    return;
  }

  if (!fn) {
    (cb || noop)({
      version:  nodeca.runtime.version,
      error:    'Unknown server method: ' + msg.method
    });
    return;
  }

  nodeca.filters.run(msg.method, msg.params, fn, function (err) {
    if (err) {
      nodeca.logger.error(err.stack || err.toString());
    }

    nodeca.debug_trace('handle_rpc() callback', err);

    (cb || noop)({
      version:  nodeca.runtime.version,
      error:    (err ? err.toString() : null),
      result:   JASON.stringify(this.response)
    });
  }, env({
      realtime: true,
      method:   msg.method
  }));
}


////////////////////////////////////////////////////////////////////////////////


realtime.attach = function attach(server, next) {
  var faye = new Faye.NodeAdapter({mount: '/faye'});

  if (process.env.FAYE_LOGLEVEL) {
    // This produces lots of logs, which are usefull
    // only during development of RT things.
    // USAGE: FAYE_LOGLEVEL=info ./fontello.js server
    Faye.Logging.logLevel = process.env.FAYE_LOGLEVEL;
  }

  // FIXME: Replace dummy active_clients inc/dec with real heartbeat/timeouts
  faye.bind('handshake',  function () { realtime.activeClients++; });
  faye.bind('disconnect', function () { realtime.activeClients--; });


  var curr_users_count = 0;
  setInterval(function () {
    if (realtime.activeClients !== curr_users_count) {
      curr_users_count = realtime.activeClients;
      faye.getClient().publish('/stats/users_online', curr_users_count);
    }
  }, 10000);


  // Limit channels clients might subscribe.
  // Applied to "browser" clients only.
  add_subscription_filter(faye, [
    // public stats updates (online users, etc)
    new RegExp('^/stats/'),
    // responses from the server client
    new RegExp('^/x/api3-res/[a-f0-9]{32}$')
  ]);


  // Limit channels clients might publish to.
  // Applied to "browser" clients only.
  add_publishing_filter(faye, [
    // requests from the browser clients
    new RegExp('^/x/api3-req/[a-f0-9]{32}$')
  ]);


  //
  // Process RPC requests
  //


  var CHANNEL_RE = new RegExp('^/x/api3-req/([a-f0-9]{32})$');

  function process_rpc(secret, data) {
    nodeca.logger.debug('API3 [%d] Got request: %s',
                        data.id, JSON.stringify(data.msg));
    handle_rpc(data.msg, function (res) {
      nodeca.logger.debug('API3 [%d] Sending response', data.id);
      faye.getClient().publish('/x/api3-res/' + secret, {
        id  : data.id,
        msg : res
      });
    });
  }

  faye.addExtension({
    // rpc calls implemented via extensions, because this is
    // the most cheapest (in terms of resources) and most
    // lean way to achieve our goal.
    incoming: function (message, callback) {
      var match = CHANNEL_RE.exec(message.channel);

      if (match) {
        process_rpc(match[1], message.data);
      }

      callback(message);
    }
  });


  faye.attach(server);
  next();
};
