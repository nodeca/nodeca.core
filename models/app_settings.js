'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  var AppSettings = new Schema({
    app_name: { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });


  AppSettings.__init__ = function () {
    return Mongoose.model(apiPath, AppSettings);
  };


  return AppSettings;
};
