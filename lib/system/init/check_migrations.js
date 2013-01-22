// Verifies that there are no outstanding migrations.
//


"use strict";


// internal
var stopwatch       = require("./utils/stopwatch");
var checkMigrations = require("../migrator").checkMigrations;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  var timer = stopwatch();

  N.models.core.Migration.getLastState(function (err, currentMigrations) {
    if (err) {
      callback(err);
      return;
    }

    if (0 < checkMigrations(currentMigrations).length) {
      callback("Can't start: database changed. Please, run migration tool:" +
               "\n    ./nodeca.js migrate");
      return;
    }

    N.logger.info('Finish migrations check ' + timer.elapsed);
    callback();
  });
};
