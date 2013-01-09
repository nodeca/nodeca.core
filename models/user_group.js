'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var UserGroup = new Schema({
    // shortcut name for the group
    name:     { type: String },
    // human readable title
    title:    { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });


  UserGroup.__init__ = function () {
    return Mongoose.model(apiPath, UserGroup);
  };


  return UserGroup;
};
