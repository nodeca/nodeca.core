// Init faye transport
//
'use strict';


var Faye = require('faye/browser/faye-browser');
var _    = require('lodash');


// Constructor
//
// - url (String) - url of server to connect
// - token (Function|String) - optional, protection token or function for lasy evaluation, default ''
//
function FayeTransport(url, token) {
  this.onmessage = null;
  this.onerror = null;

  this.__url__ = url;
  this.__token__ = token || '';
  this.__subscriptions__ = [];
  this.__client__ = null;
}


// Connect to server
//
FayeTransport.prototype.connect = function () {
  var self = this;

  this.__client__ = new Faye.Client(this.__url__);
  this.__client__.addExtension({
    outgoing: function (message, callback) {
      message.token = _.isFunction(self.__token__) ? self.__token__() : self.__token__;
      callback(message);
    },
    incoming: function (message, callback) {
      if (message.error && self.onerror) {
        self.onerror(message.error);
      }

      callback(message);
    }
  });
};


// Subscribe to channels
//
// - channels ([String]) - channels list
//
FayeTransport.prototype.subscribe = function (channels) {
  var self = this;

  channels.forEach(function (channel) {
    var escapedName = self.__escape_channel__(channel);

    if (self.__subscriptions__[escapedName]) {
      return;
    }

    self.__subscriptions__[escapedName] = self.__client__.subscribe(escapedName, function (message) {
      if (self.onmessage) {
        self.onmessage(channel, message);
      }
    });
  });
};


// Unsubscribe to channels
//
// - channels ([String]) - channels list
//
FayeTransport.prototype.unsubscribe = function (channels) {
  var self = this;

  channels.forEach(function (channel) {
    channel = self.__escape_channel__(channel);

    self.__subscriptions__[channel].cancel();
    self.__subscriptions__[channel] = null;
  });
};


// Emit message
//
FayeTransport.prototype.emit = function (channel, data) {
  channel = this.__escape_channel__(channel);

  this.__client__.publish(channel, data);
};


// Close connection
//
FayeTransport.prototype.disconnect = function () {
  this.__client__.disconnect();
};


// Convert channel name to faye compatible format: add '/' at start of
// channel name and replace '.' with '!!'
//
FayeTransport.prototype.__escape_channel__ = function (name) {
  return (name[0] === '/' ? name : '/' + name).replace(/\./g, '!!');
};


module.exports = FayeTransport;
