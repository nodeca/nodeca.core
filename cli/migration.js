"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.commandName ="migrate";

module.exports.parserParameters= {
  addHelp:true,
  description: 'Run migrations',
  help: 'run migrations'
};

module.exports.commandLineArguments = [];

module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/redis'),
    require('../lib/init/mongoose'),
    NLib.init.loadModels,
  ], function (err) {
    if (err){
      callback(err);
    }
   
    var migration_model = nodeca.models.core.migration;
    var migrator = nodeca.runtime.migrator;

    // fetch used migrations from db
    migration_model.getLastState(function(err, last_state){
      // find new migrations
      migrator.checkMigrations(last_state, function(err, new_migrations){
        Async.forEachSeries(new_migrations, function(migration, next_migration){
          migrator.runMigration(migration, function(err){
            if (err){
              next_migration(err);
              return;
            }

            // All ok. Write step to db
            migration_model.markPassed( migration.app_name, migration.step, function(err){
              if (!err){
                nodeca.logger.log(migration.app_name + ': ' + migration.step +' successfully migrated');
              }
              next_migration(err);
            });
          });
        }, function(err) {
          if (err) {
            callback(err);
          }
          process.exit(0);
        });
      });
    });
  });
};
