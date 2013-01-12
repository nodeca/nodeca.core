/**
 *  class Wire
 **/


"use strict";


// 3rd-party
var _           = require("underscore");
var async       = require("async");
var SortedArray = require("collections/sorted-array");
var Dict        = require("collections/dict");


////////////////////////////////////////////////////////////////////////////////


// "dummy" handler
function noop() {}


////////////////////////////////////////////////////////////////////////////////


function PatternMatcher(str) {
  var re = str.replace(/\*+/g, function (m) {
    return '*' === m ? '[^.]+?' : '.+?';
  });

  Object.defineProperty(this, 'value',  { value: str });
  Object.defineProperty(this, 'regexp', { value: new RegExp("^" + re + "$") });
}


PatternMatcher.prototype.toString = function () {
  return "" + this.value;
};


PatternMatcher.prototype.match = function (str) {
  str = String(str).replace(/\*/g, 'xxx');
  return this.regexp.test(str);
};


PatternMatcher.prototype.hasWildcards = function () {
  return 0 <= this.value.indexOf('*');
};


////////////////////////////////////////////////////////////////////////////////


function WireHandler(func, options) {
  options = options || {};

  this.func     = func;
  this.sync     = 1 === func.length;
  this.ensure   = !!options.ensure;
  this.priority = +(options.priority || 10);
  this.ncalled  = 0;
}


WireHandler.prototype.exec = function (params, callback) {
  this.ncalled++;
  return this.func(params, callback);
};


// internal: vlidates given `func` t be Function with exactly 1 or 2 arguments,
//           throws exception otherwise.
//
WireHandler.validate = function (func) {
  if (!_.isFunction(func)) {
    throw "Not a function";
  }

  if (func.length < 1 && 2 < func.length) {
    throw "Function must accept exactly 1 (sync) or 2 (async) arguments";
  }
};


WireHandler.compare = function (a, b) {
  return Object.compare(a.priority, b.priority);
};


WireHandler.equals = function (a, b) {
  return a.handler === b.handler;
};


////////////////////////////////////////////////////////////////////////////////


function WireChannel(name) {
  Object.defineProperty(this, 'pattern',  { value: new PatternMatcher(name) });
  Object.defineProperty(this, 'handlers', {
    value: new SortedArray([], WireHandler.equals, WireHandler.compare)
  });
}


////////////////////////////////////////////////////////////////////////////////


function Wire() {
  Object.defineProperty(this, '__channels__', {
    value: new Dict(null, function (key) {
      var val = new WireChannel(key);

      this.set(key, val);

      return val;
    })
  });
}


Wire.prototype.getHandlers = function (channel) {
  if (!this.__cache__[channel]) {
    this.__cache__[channel] = [];
    this.__channels__.forEach(function (wc) {
      if (wc.match(channel)) {
        wc.handlers.forEach(function (wh) {
          this.__cache__[channel].push(wh);
        });
      }
    }, this);
  }

  return this.__cache__[channel];
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
  var firstError;

  async.forEachSeries(this.getHandlers(channel), function (handler, next) {
    // error occured on previous handler,
    // skip this one unless it's "forced"
    if (firstError && !handler.ensure) {
      next();
      return;
    }

    // fire sync handler. notice, handler must
    // try/catch inside and return them if needed.
    if (handler.sync) {
      firstError = firstError || handler.exec(params);
      next();
      return;
    }

    // fire async handler.
    handler.exec(params, function (err) {
      firstError = firstError || err;
      next();
    });
  }, function () {
    callback(firstError);
  });
};


// internal: return list of handlers for channel
Wire.prototype.getHandlers = function (channel) {

};


Wire.prototype.resetCache = function () {

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
 *  - `priority` (Number, Default: 10)
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

  WireHandler.validate(handler);

  this.resetCache();
  this.__handlers__.get(channel).add(new WireHandler(handler, options));
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

  WireHandler.validate(handler);

  if (1 === handler.length || noop === handler) {
    realHandler = function (params) {
      var _handler = handler;

      handler = noop;
      self.off(channel, realHandler);

      return _handler(params);
    };
  } else {
    realHandler = function (params, callback) {
      var _handler = handler;

      handler = noop;
      self.off(channel, handler);

      _handler(params, callback);
    };
  }

  // save "original" handler to be able remove it upon `off` called by user
  Object.defineProperty(realHandler, '__original__', handler);

  this.on(channel, options, realHandler);
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
  this.resetCache();

  this.__handlers__.forEach(function (wc, channel) {
    if (!wc.match(channel)) {
      return;
    }

    if (!handler) {
      wc.clear();
      return;
    }

    wc.forEach(function (wh) {
      if (wh.func === handler || wh.func.__original__ === handler) {
        this["delete"](wh);
      }
    }, this);
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
 *  - `priority` (Number, Default: 10)
 *  - `ensure` (Boolean, Default: false)
 *    Search for handlers with `ensure` flag only.
 **/
Wire.prototype.has = function (channel, options, handler) {
  return 0 < this.getHandlers(channel).filter(function (h) {
    var match = true;

    if (_.has(options, 'priority')) {
      match = match && h.priority === options.priority;
    }

    if (_.has(options, 'ensure')) {
      match = match && !!h.ensure;
    }

    return match;
  }).length;
};


/**
 *  Wire#stat([match = "*"][, options]) -> String
 *  - `match` (String|RegExp):
 *    List info about channels matching given Glob|RegExp pattern only.
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
Wire.prototype.stat = function (match, options) {
  throw "Not implemented yet";
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Wire;
