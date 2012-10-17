'use strict';


/*global nodeca*/


/**
 *  nodeca.permissions
 **/
nodeca.permissions = module.exports = {};


/**
 *  nodeca.permissions.fetch(keys, params, callback) -> Void
 **/
module.exports.fetch = function fetch(keys, params, callback) {
  var data = {};

  keys.forEach(function (key) { data[key] = false; });

  callback(null, data);
};


/**
 *  nodeca.permissions.fetchSync(keys, params) -> Object
 **/
module.exports.fetchSync = function fetchSync(keys, params) {
  // returns calculated object of permissions of keys
};


var requiredKeys = {};


/**
 *  nodeca.permissions.shouldFetch(apiPath, keys) -> Void
 **/
module.exports.shouldFetch = function shouldFetch(apiPath, keys) {
  requiredKeys[apiPath] = (requiredKeys[apiPath] || []).concat(keys);
};


module.exports.getRequiredKeys = function getRequiredKeys(apiPath) {
  return requiredKeys[apiPath] || [];
};


/**
* nodeca.permissions.cache(env, storeName, params, settings) -> Void
**/
module.exports.cache = function cache(env, storeName, params, settings) {
};
