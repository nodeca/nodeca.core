// Verifies that there are no outstanding migrations.
//


"use strict";


var checkMigrations = require("../migrator").checkMigrations;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.on("init:migrations", function migrations_check(N, next) {
    N.models.core.Migration.getLastState(function (err, currentMigrations) {
      if (err) {
        next(err);
        return;
      }

      if (0 < checkMigrations(N, currentMigrations).length) {
        next("Can't start: database changed. Please, run `mirgate --all` command");
        return;
      }

      N.logger.info('Checked DB migrations');
      next();
    });
  });
};
