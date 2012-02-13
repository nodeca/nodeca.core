'use strict';


module.exports = function (app, callback) {
  var Schema = app.mongoose.Schema;
  var AppSettingsSchema = new Schema({
    app_name: { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });


  callback(null, AppSettingsSchema);
};
