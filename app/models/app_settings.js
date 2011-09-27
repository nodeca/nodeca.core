module.exports = (function (app, callback) {
  var Schema = app.mongoose.Schema,
      ObjectId = Schema.ObjectId;
  
  
  var AppSettingsSchema = new Schema({
    app_name: { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });  


  callback(null, AppSettingsSchema);
});
  

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
