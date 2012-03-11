'use strict';


module.exports = function (app, callback) {
  var Schema = app.mongoose.Schema;
  var MigrationsSchema = new Schema({
    //ToDo
  });


  callback(null, MigrationsSchema);
};
