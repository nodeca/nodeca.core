'use strict';


/**
 *  nodeca.permissions
 **/


/**
 *  nodeca.permissions.fetch(keys, params, callback) -> Void
 **/
module.exports.fetch = function fetch(keys, params, callback) {
  var data = {};

  keys.forEach(function (key) { data[key] = true; });

  callback(null, data);
};


/**
 *  nodeca.permissions.fetchSync(keys, params) -> Object
 **/
module.exports.fetchSync = function fetchSync(keys, params) {
  // returns calculated object of permissions of keys
};


/**
 *  nodeca.permissions.shouldFetch(apiPath, keys) -> Void
 **/
module.exports.shouldFetch = function shouldFetch(apiPath, keys) {
};


/**
* nodeca.permissions.cache(env, storeName, params, settings) -> Void
**/
module.exports.cache = function cache(env, storeName, params, settings) {
};
