'use strict';


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


/**
 *  nodeca.permissions
 **/
nodeca.permissions = module.exports = {};


////////////////////////////////////////////////////////////////////////////////


/**
 *  nodeca.permissions.fetch(keys, params, callback) -> Void
 **/
module.exports.fetch = function (keys, params, callback) {
  var data = {}, single = _.isArray(keys);

  _.each(single ? keys : [keys], function (key) { data[key] = true; });
  callback(null, single ? data[keys] : data);
};
