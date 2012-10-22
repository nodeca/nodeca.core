'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;


////////////////////////////////////////////////////////////////////////////////


var UsergroupStore = new Store({
  get: function (key, params, options, callback) {
    callback(null, {
      value: UsergroupStore.getDefaultValue(key)
    });
  },
  set: function (values, params, callback) {
    callback('Not implemented yet');
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = UsergroupStore;
