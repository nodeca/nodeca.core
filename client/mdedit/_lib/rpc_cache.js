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


const _ = require('lodash');

/* eslint-disable no-redeclare */
var N;


// - delay (Number) - optional, delay before make request to actualize request, default 3000 ms
//
function RpcCache(delay) {
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
  // Sandbox for keeping a state (custom caches) between parser executions
  this.sandbox = {};
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

  this.__handlers__[eventName].forEach(handler => handler(data));
};


// Check request is in cahce
//
RpcCache.prototype.has = function (apiPath, data) {
  let key = getCacheKey(apiPath, data);
  let result = this.__cache__.hasOwnProperty(key);

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
  // If `trackStop()` called without `trackStart()` - skip
  if (!this.__trackedUpdate__) return;

  let tracked = this.__tracked__;

  // Remove requests if not added in tracker
  tracked = _.reduce(tracked, (acc, v, k) => {
    if (this.__trackedUpdate__[k]) {
      acc[k] = v;
    }

    return acc;
  }, {});

  // Add new requests
  _.forEach(this.__trackedUpdate__, (v, k) => {
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
  _.forEach(this.__tracked__, (v, k) => {
    // If request timeout is over
    if (v[2] + this.__delay__ < Date.now()) {
      // Remove request from tracked
      delete this.__tracked__[k];

      // Make request
      N.io.rpc(v[0], v[1], { persistent: true, handleAllErrors: true })
        .then(res => {
          // Update cache data and emit event
          this.__cache__[k] = res;
          this.emit('update');
        })
        .catch(err => {
          // Add 404 and 401 results to cache, skip other codes
          if ([ N.io.NOT_FOUND, N.io.FORBIDDEN ].indexOf(err.code) !== -1) {
            this.__cache__[k] = null;
          }
        });
    }
  });

  // If no more tracked data - stop timer
  if (Object.keys(this.__tracked__).length === 0) {
    clearInterval(this.__timer__);
    this.__timer__ = null;
  }
};


module.exports = function (_N) {
  N = _N;

  return RpcCache;
};
