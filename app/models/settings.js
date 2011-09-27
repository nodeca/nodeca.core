module.exports = (function (app, callback) {
  var Schema = app.mongoose.Schema,
      ObjectId = Schema.ObjectId;
  
  
  var SettingsSchema = new Schema({
    app:      { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });  


  callback(null, SettingsSchema);
});
  

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
