"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.commandName ="migrate";

module.exports.parserParameters= {
  addHelp:true,
  description: 'Run migrations',
  help: 'A help'
};


module.exports.commandLineArguments = [];

/**
 * run(args, callback)-> void
 * - args (array): parsed arguments
 * - callback(function): callback function
 *
 * args example:
 *    { command_name: 'migration', foo: 'baz', bar: '1' }
 *
 **/
module.exports.run = function (args, callback) {
  Async.series([
    require('../lib/init/mongoose'),
    NLib.init.loadModels,
    NLib.init.loadSharedApiSubtree
  ], function (err) {
    if (err){
      console.log(err);
      process.exit(1);
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
            nodeca.logger.log(err);
            process.exit(1);
          }
          process.exit(0);
        });
      });
    });
  });
};
