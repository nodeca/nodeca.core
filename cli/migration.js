"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.commandName ="migrate";

module.exports.parserParameters= {
  addHelp:true,
  description: 'Without args show new migrations. With ' +
    ' `--all` run all migrations.',
  help: 'run migrations'
};

module.exports.commandLineArguments = [
  {
    args: ['--all'],
    options: {
      help: 'run all migrations',
      action: 'storeTrue'
    }
  }
];

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
        if (!args.all && new_migrations.length >0) {
          console.log('New migrations:');
        }
        Async.forEachSeries(new_migrations, function(migration, next_migration){
          if (!args.all) {
            console.log(migration.app_name + ':' + migration.step);
            next_migration();
            return;
          }
          else {
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
          }
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
