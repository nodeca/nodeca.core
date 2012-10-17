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
