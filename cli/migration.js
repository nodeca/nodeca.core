"use strict";


/*global nodeca*/

// nodeca
var NLib = require('nlib');

var Async = NLib.Vendor.Async;

module.exports.commandName = "migrate";

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
   
    var Migration = nodeca.models.core.Migration;
    var migrator = nodeca.runtime.migrator;

    // fetch used migrations from db
    Migration.getLastState(function(err, last_state){
      // find new migrations
      migrator.checkMigrations(last_state, function(err, new_migrations){
        if (0 === new_migrations.length) {
          console.log(args.all ? 'Already up-to-date.' :
                      'You have no outstanding migrations');
          process.exit(0);
        }

        if (!args.all) {
          console.log('You have ' + new_migrations.length +
                      ' outstanding migration(s):\n');
        } else {
          console.log('Applying ' + new_migrations.length +
                      ' outstanding migration(s):\n');
        }

        Async.forEachSeries(new_migrations, function(migration, next_migration){
          var migration_title = '  ' + migration.app_name + ':' + migration.step;

          if (!args.all) {
            console.log(migration_title);
            next_migration();
            return;
          }

          migrator.runMigration(migration, function(err){
            if (err){
              next_migration(err);
              return;
            }

            // All ok. Write step to db
            Migration.markPassed(migration.app_name, migration.step, function(err){
              if (!err){
                console.log(migration_title +' -- success');
              } else {
                console.log(migration_title +' -- failed');
              }

              next_migration(err);
            });
          });
        }, function(err) {
          if (err) {
            callback(err);
          }

          if (!args.all) {
            console.log('\nRun `migrate` command with `--all` to apply them.');
          }

          process.exit(0);
        });
      });
    });
  });
};
