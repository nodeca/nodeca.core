'use strict';


module.exports = function (app, callback) {
  var Schema = app.mongoose.Schema;
  var UserGroupSchema = new Schema({
    // shortcut name for the group
    name:     { type: String },
    // human readable title
    title:    { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });


  callback(null, UserGroupSchema);
};
