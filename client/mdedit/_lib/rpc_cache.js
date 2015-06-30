// Request data with delay and cache result
//
//   var cache = new RpcCache();
//
//   cache.trackStart();
//
//   $tags.forEach(function ($tag) {
//     var res = cache.get('common.embed', { link: $tag.attr('href'), type: 'block' });
//
//     if (res) { /* ... */ }
//   });
//
//   cache.trackStop();
//
'use strict';


var _ = require('lodash');
var N;


// - delay (Number) - optional, delay before make request to actualize request, default 3000 ms
//
function RpcCache(delay) {
  var self = this;
  this.__delay__ = delay || 3000;

  // Response cache
  this.__cache__ = {};
  // Data that wait for request
  this.__tracked__ = {};
  // Data update, used between `.trackStart()` and `.trackStop()`
  this.__trackedUpdate__ = null;
  // Event handlers
  this.__handlers__ = {};
  // Check timer
  this.__timer__ = null;
}

// Get cache key by params
//
function getCacheKey(apiPath, data) {
  return JSON.stringify([ apiPath, data ]);
}


// Subscribe to event
//
RpcCache.prototype.on = function (eventName, handler) {
  this.__handlers__[eventName] = this.__handlers__[eventName] || [];

  this.__handlers__[eventName].push(handler);
};


// Emit event
//
RpcCache.prototype.emit = function (eventName, data) {
  if (!this.__handlers__[eventName]) {
    return;
  }

  this.__handlers__[eventName].forEach(function (handler) {
    handler(data);
  });
};


// Check request is in cahce
//
RpcCache.prototype.has = function (apiPath, data) {
  var key = getCacheKey(apiPath, data);
  var result = this.__cache__.hasOwnProperty(key);

  if (!result) {
    // If new track started - append data to update
    if (this.__trackedUpdate__) {
      this.__trackedUpdate__[key] = [ apiPath, data, Date.now() ];

    // If default track - append data to tracked and start tracking if needed
    } else {
      this.__tracked__[key] = [ apiPath, data, Date.now() ];

      if (!this.__timer__) {
        this.__timer__ = setInterval(this.__tick__.bind(this), 300);
      }
    }
  }

  return result;
};


// Get data from cache or add it to tracked
//
RpcCache.prototype.get = function (apiPath, data) {
  if (this.has(apiPath, data)) {
    return this.__cache__[getCacheKey(apiPath, data)];
  }
};


// Start new tracker
//
RpcCache.prototype.trackStart = function () {
  this.__trackedUpdate__ = {};
};


// Stop new tracker
//
RpcCache.prototype.trackStop = function () {
  var self = this;
  var tracked = this.__tracked__;

  // Remove requests if not added in tracker
  tracked = _.reduce(tracked, function (acc, v, k) {
    if (self.__trackedUpdate__[k]) {
      acc[k] = v;
    }

    return acc;
  }, {});

  // Add new requests
  _.forEach(this.__trackedUpdate__, function (v, k) {
    if (!tracked[k]) {
      tracked[k] = v;
    }
  });

  this.__tracked__ = tracked;
  this.__trackedUpdate__ = null;

  if (!this.__timer__ && Object.keys(this.__tracked__).length !== 0) {
    this.__timer__ = setInterval(this.__tick__.bind(this), 300);
  }
};


// Update timer tick
//
RpcCache.prototype.__tick__ = function () {
  var self = this;

  _.forEach(self.__tracked__, function (v, k) {
    // If request timeout is over
    if (v[2] + self.__delay__ < Date.now()) {
      // Remove request from tracked
      delete self.__tracked__[k];

      // Make request
      N.io.rpc(v[0], v[1], { persistent: true, handleAllErrors: true })
        .done(function (res) {
          // Update cache data and emit event
          self.__cache__[k] = res;
          self.emit('update');
        })
        .fail(function (err) {
          // Add 404 and 401 results to cache, skip other codes
          if ([ N.io.NOT_FOUND, N.io.FORBIDDEN ].indexOf(err.code) !== -1) {
            self.__cache__[k] = null;
          }
        });
    }
  });

  // If no more tracked data - stop timer
  if (Object.keys(self.__tracked__).length === 0) {
    clearInterval(self.__timer__);
    this.__timer__ = null;
  }
};


module.exports = function (_N) {
  /* eslint-disable no-undef */
  N = _N;
  /* eslint-enable no-undef */

  return RpcCache;
};
