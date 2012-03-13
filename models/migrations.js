'use strict';

var nodeca = global.nodeca;

var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;

var Migrations = module.exports.Migrations = new mongoose.Schema({
    migrations: { type: Array, required: true}
}, { strict: true });

Migrations.statics.getCurrentMigrations = function(callback){
  // for single document
  this.findById('migrations', function (err, doc){
    if (err) {
      callback(err);
    }
    callback(doc['migrations']);
  });
};

Migrations.statics.mark_passed = function(migration, callback){
  callback();
};

module.exports.__init__ = function __init__() {
  return mongoose.model('migrations', Migrations);
};
