/**
 *  class Wire
 **/


"use strict";


// 3rd-party
var _ = require("underscore");


////////////////////////////////////////////////////////////////////////////////


// "dummy" handler
function noop() {}


////////////////////////////////////////////////////////////////////////////////


// Structure to hold handler data
function WireHandler(channel, options, func) {
  this.channel  = channel;
  this.func     = func;
  this.sync     = 1 === func.length;
  this.once     = Boolean(options.once);
  this.ensure   = Boolean(options.ensure);
  this.priority = Number(options.priority || 0);
  this.ncalled  = 0;
  this.pattern  = new RegExp("^" + channel.replace(/\*+/g, function (m) {
                    // '*' - anything but "dot"
                    // '**' -
                    return '*' === m ? '[^.]+?' : '.+?';
                  }) + "$");
}


////////////////////////////////////////////////////////////////////////////////


function Wire() {
  this.__handlers__       = [];
  this.__sortedCache__    = [];
  this.__knownChannels__  = {};
}


Wire.prototype.getHandlers = function (channel) {
  if (!this.__sortedCache__[channel]) {
    this.__sortedCache__[channel] = _.chain(this.__handlers__)
      .filter(function (wh) {
        return wh.match(channel);
      }).sort(function (a, b) {
        if (a.priority === b.priority) {
          return 0;
        }

        return (a.priority < b.priority) ? -1 : 1;
      }).value();
  }

  return this.__sortedCache__[channel];
};


/**
 *  Wire#emit(channel, params[, callback]) -> Void
 *  - channel (String):
 *  - params (Mixed):
 *  - callback (Function):
 *
 *  Sends message with `params` into the `channel`. Once all sync and ascync
 *  handlers finished, optional `callback(err)` (if specified) fired.
 **/
Wire.prototype.emit = function (channel, params, callback) {
  var stash;

  callback = callback || noop;

  if (!this.isKnown(channel)) {
    callback("Unknown channel");
    return;
  }

  // get array of associated handlers
  stash = this.getHandlers(channel).slice();

  // helps to prevent from double-firing callback
  // when developer forgot to interrupt:
  //
  //    function doSomething(params, next) {
  //      try {
  //        // ...
  //      } catch (err) {
  //        next(err);
  //      }
  //
  //      next();
  //    }
  function done(err) {
    var _callback = callback;

    stash    = [];
    callback = noop;

    _callback(err);
  }

  // iterates through handlers of stash
  function walk(err) {
    var wh;

    if (err || !stash.length) {
      done(err);
      return;
    }

    while (stash.length) {
      wh = stash.shift();
      fn = wh.func;

      wh.ncalled += 1;

      if (wh.once) {
        self.off(wh.handler, fn);
      }

      if (!wh.sync) {
        fn(params, walk);
        return;
      }

      err = fn(params);

      if (err) {
        done(err);
        return;
      }
    }
  }

  // start stash walker
  walk();
};


/**
 *  Wire#on(channel[, options], handler) -> Void
 *  - channel (String):
 *  - options (Object):
 *  - handler (Function):
 *
 *  Registers `handler` to be executed upon messages in the `channel`. Handler
 *  can be either sync function:
 *
 *      wire.on('foobar', function (params) {
 *        // do stuff here
 *      });
 *
 *  Or it might be an async function with `callback(err)` second argument:
 *
 *      wire.on('foobar', function (params, callback) {
 *        // do stuff here
 *        callback(null);
 *      });
 *
 *
 *  ##### Options
 *
 *  - `priority` (Number, Default: 0)
 *  - `exclude` (String|RegExp, Default: Null)
 *    Glob or RegExp patther to exclude channels from being listened.
 *  - `ensure` (Boolean, Default: false)
 *    If `true`, will run handler even if one of previous fired error.
 **/
Wire.prototype.on = function (channel, options, handler) {
  if (!handler) {
    handler = options;
    options = null;
  }

  options = options || {};

  if (!_.isFunction(handler)) {
    throw "Not a function";
  }

  if (handler.length < 1 && 2 < handler.length) {
    throw "Function must accept exactly 1 (sync) or 2 (async) arguments";
  }

  // got channel handler (no wildcards)
  if (-1 === channel.indexOf('*')) {
    this.__knownChannels__[channel] = (this.__knownChannels__[channel] || 0) + 1;
  }

  this.__sortedCache__ = [];
  this.__handlers__.push(new WireHandler(channel, options, handler));
};


/**
 *  Wire#once(channel[, options], handler) -> Void
 *  - channel (String):
 *  - options (Object):
 *  - handler (Function):
 *
 *  Same as [[Wire#on]] but runs handler one time only.
 **/
Wire.prototype.once = function (channel, options, handler) {
  var self = this, realHandler;

  if (!handler) {
    handler = options;
    options = null;
  }

  Wire.prototype.on(channel, _.extend(options, { once: true }), handler);
};


/**
 *  Wire#before(channel[, options], handler) -> Void
 *  - channel (String):
 *  - options (Object):
 *  - handler (Function):
 *
 *  Same as [[Wire#on]] but with "fixed" priority of `-10`
 **/
Wire.prototype.before = function (channel, options, handler) {
  if (!handler) {
    handler = options;
    options = null;
  }

  options = _.extend({ priority: 10 }, options);

  if (0 <= options.priority) {
    throw "before() requires priority lower than 0";
  }

  return this.on(channel, options, handler);
};


/**
 *  Wire#after(channel[, options], handler) -> Void
 *  - channel (String):
 *  - options (Object):
 *  - handler (Function):
 *
 *  Same as [[Wire#on]] but with default priority of `10`
 **/
Wire.prototype.after = function (channel, options, handler) {
  if (!handler) {
    handler = options;
    options = null;
  }

  options = _.extend({ priority: 10 }, options);

  if (0 >= options.priority) {
    throw "after() requires priority greater than 0";
  }

  return this.on(channel, options, handler);
};


/**
 *  Wire#off(channel[, handler]) -> Void
 *  - channel (String):
 *  - handler (Function):
 *
 *  Removes `handler` of a channel, or removes ALL handlers of a channel if
 *  `handler` is not given.
 **/
Wire.prototype.off = function (channel, handler) {
  // got channel handler (no wildcards)
  if (-1 === channel.indexOf('*')) {
    this.__knownChannels__[channel] -= 1;
  }

  _.each(this.__handlers__, function (wh) {
    if ((channel !== wh.channel) || (handler && handler !== wh.func)) {
      return;
    }

    handler.sync = true;
    handler.func = noop;
  });
};


/**
 *  Wire#has(channel[, options][, handler]) -> Void
 *  - channel (String):
 *  - handler (Function):
 *
 *  Returns if `handler` is listening `channel`, or if `channel`
 *  has at least one subscriber if `handler` is not given.
 *
 *
 *  ##### Options
 *
 *  - `priority` (Number)
 *  - `ensure` (Boolean)
 *    Search for handlers with `ensure` flag only.
 **/
Wire.prototype.isKnown = function (channel) {
  return Boolean(this.__knownChannels__[channel]);
};


/**
 *  Wire#stat([channel][, options]) -> String
 *  - `channel` (String):
 *    List info about specified channel only.
 *  - options (Object):
 *
 *  Returns statistics that includes by default all channels list alphabetically
 *  sorted with subscribers count; For each sbscriber it shows names and count
 *  of times it was triggered by far.
 *
 *  ##### Options
 *
 *  - `subscribers` (Boolean, Default: true): List subscribers with their names
 *    and amount of times they were fired.
 **/
Wire.prototype.stat = function (channel, options) {
  var channels;

  if (channel && !options && _.isObject(match)) {
    options = match;
    channel = null;
  }

  options   = _.extend({ subscribers: true }, options);
  channels  = channel ? [channel] : _.keys(this.__knownChannels__);

  return _.map(channels, function (name) {
    var
    stash   = this.getHandlers(name),
    result  = name + " (" + stash.length + ")";

    if (options.subscribers) {
      result += "\n" + _.map(stash, function (wh) {
        return "  " + (wh.func.name || "<anonymous>") + " (" + wh.ncalled + ")";
      });
    }

    return result;
  }).join("\n\n");
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Wire;