module.exports = (function (app, callback) {
  var Schema = app.mongoose.Schema,
      ObjectId = Schema.ObjectId;
  
  
  var UserGroupSchema = new Schema({
    // shortcut name for the group
    name:     { type: String },
    // human readable title
    title:    { type: String },
    settings: { type: Schema.Types.Mixed, default: {}}
  });  


  callback(null, UserGroupSchema);
});
  

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
