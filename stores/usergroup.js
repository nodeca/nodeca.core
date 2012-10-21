'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;


////////////////////////////////////////////////////////////////////////////////


module.exports = new Store({
  get: function (key, params, options, callback) {
    callback(null, { value: true });
  },
  set: function (values, params, callback) {
    callback('Not implemented yet');
  }
});
