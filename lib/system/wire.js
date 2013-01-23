/**
 *  class Wire
 **/


"use strict";


/*global underscore*/


// 3rd-party
var _ = underscore;


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
        return wh.pattern.test(channel);
      }).sort(function (a, b) {
        if (a.priority === b.priority) {
          return 0;
        }

        return (a.priority < b.priority) ? -1 : 1;
      }).value();
  }

  return this.__sortedCache__[channel];
};


// Internal helper that runs handlers for a single channel
function emitSingle(self, channel, params, callback) {
  var stash;

  if (!self.isKnown(channel)) {
    callback("Unknown channel");
    return;
  }

  // get array of associated handlers
  stash = self.getHandlers(channel).slice();

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
    var wh, fn;

    if (err || !stash.length) {
      done(err);
      return;
    }

    while (stash.length) {
      wh = stash.shift();
      fn = wh.func;

      wh.ncalled += 1;

      if (wh.once) {
        self.off(wh.channel, fn);
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
}


/**
 *  Wire#emit(channels, params[, callback]) -> Void
 *  - channels (String|Array):
 *  - params (Mixed):
 *  - callback (Function):
 *
 *  Sends message with `params` into the `channel`. Once all sync and ascync
 *  handlers finished, optional `callback(err)` (if specified) fired.
 **/
Wire.prototype.emit = function (channels, params, callback) {
  var self = this;

  callback = callback || noop;
  channels = _.isArray(channels) ? channels.slice() : [channels];

  function walk(err) {
    var chhan;

    if (err || !channels.length) {
      callback(err);
      return;
    }

    chan = channels.shift();
    emitSingle(self, chan, params, walk);
  }

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

  if (!channel) {
    throw "Channel is required. Use `**` if you want 'any channel'.";
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
  var self = this;

  if (!handler) {
    handler = options;
    options = null;
  }

  options = _.extend(options || {}, { once: true })
  this.on(channel, options, handler);
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

  options = _.extend({ priority: -10 }, options);

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
 *  Wire#isKnown(channel[, options][, handler]) -> Void
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
 *  Wire#stat() -> Object
 *
 *  Returns full statictics about all channels. Only channels without wildcards
 *  are displayed. Each channel has following structures:
 *
 *  ```
 *  {
 *    name: channnelName,
 *    listeners: Array[handlerStat]
 *  }
 *  ```
 **/
Wire.prototype.stat = function () {
  var self = this;

  return _.map(this.__knownChannels__, function (count, name) {
    return { name : name, listeners: self.getHandlers(name) };
  });
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Wire;
