"use strict";


/*global nodeca*/


module.exports = function (next) {
  // fetch used migrations from db
  nodeca.models.core.migration.getLastState(function(err, last_state){
    if (err) {
      next(err);
      return;
    }

    // finde new migrations
    nodeca.runtime.migrator.checkMigrations(last_state, function(err, new_migrations){
      if (!err && new_migrations.length > 0){
        err = "Can't start: database changed. Please, run migration tool:" +
              "\n    ./nodeca.js migrate";
      }

      next(err);
    });
  });
};
