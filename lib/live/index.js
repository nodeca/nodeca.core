// Cross tab comunication for single connection
//
'use strict';


/* global window */
var _           = require('lodash');
var LSProxy     = require('./proxy/ls');


// Constructor
//
// - options (Object)
//   - baseUrl (String) - optional, base application URL to determine iframe usage, default `window.location.origin`
//   - namespace (String) - optional, prefix for `localStorage`, default 'live_'
//   - transport (Object) - connection handler
//
function Live(options) {
  var self = this;

  var opt = _.defaults(options, {
    namespace: 'live_',
    baseUrl: window.location.origin
  });

  this.__baseUrl__ = opt.baseUrl;
  this.__transport__ = opt.transport;
  this.__namespace__ = opt.namespace;
  this.__subscriptions__ = [];

  // TODO: Here we should check:
  // - if ServiceWorkers available and `baseUrl` is same with origin - use proxy for ServiceWorkers
  // - if ServiceWorkers available and `baseUrl` is not same with origin - use proxy for iframe + ServiceWorkers
  // - if localStorage available and `baseUrl` is same with origin - use localStorage
  // - if localStorage available and `baseUrl` is not same with origin - use iframe + localStorage
  // - another case - use proxy for direct connection

  if (LSProxy.ok()) {
    this.__proxy__ = new LSProxy(this.__namespace__, this.__transport__);
  }

  // Subscribe to proxy messages
  this.__proxy__.onmessage = function (channel, message) {
    self.__subscriptions__.filter(function (subscription) {
      return subscription.channel === channel;
    }).forEach(function (subscription) {
      subscription.handler(message);
    });
  };
}


// Subscribe channel
//
// - channel (String) - channel name
// - handler (Function) - channel handler
// - handlerNamespace (String) - optional, handler namespace, default ''
//
Live.prototype.on = function (channel, handler, handlerNamespace) {
  var isProxyAlreadySubscribed = false;

  if (_.findIndex(this.__subscriptions__, function (subscribe) { return subscribe.channel === channel; }) !== -1) {
    isProxyAlreadySubscribed = true;
  }

  this.__subscriptions__.push({
    channel: channel,
    handler: handler,
    handlerNamespace: handlerNamespace
  });

  if (!isProxyAlreadySubscribed) {
    this.__proxy__.on(channel);
  }
};


// Unsubscribe channel
//
// - channel (String) - channel name
// - handler (Function) - optional, all if not set
// - handlerNamespace (String) - optional, dot separated handler namespace
//
Live.prototype.off = function (channel, handler, handlerNamespace) {
  if (!_.isString(handler)) {
    handlerNamespace = handler;
    handler = null;
  }

  this.__subscriptions__ = _.remove(this.__subscriptions__, function (subscribe) {
    return !(
      (subscribe.channel === channel) &&
      (!handler || handler === subscribe.handler) &&
      // TODO: check namespace like in jQuery
      (!handlerNamespace || handlerNamespace === subscribe.handlerNamespace)
    );
  });

  if (_.findIndex(this.__subscriptions__, function (subscribe) { return subscribe.channel === channel; }) === -1) {
    this.__proxy__.off(channel);
  }
};


// Send message to server
//
// - channel (String) - channel name
// - data (Object) - custom user data
//
Live.prototype.emit = function (channel, data) {
  this.__proxy__.emit(channel, data);
};


module.exports = Live;
