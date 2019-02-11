// Verifies that there are no outstanding migrations.
//


'use strict';


const _        = require('lodash');
const path     = require('path');
const glob     = require('glob').sync;
const Mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////

//
// Create model & methods
//

let Migration = new Mongoose.Schema({
  app: { type: String }, // app name
  steps: [ String ]      // array of migration files for app
}, { strict: true });

// Mark migration as applyed. Each migration
// is identified by (application_name, migration_file_name)
//
Migration.statics.markPassed = function (app_name, step) {
  return this.find({ app: app_name }).then(docs => {
    if (docs.length > 0) {
      return this.updateOne({ app: app_name }, { $push: { steps: step } });
    }

    return this.create({ app: app_name, steps: [ step ] });
  });
};

// Upgrade old records where app is stored in _id
//
// TODO: remove this later
//
Migration.statics.updateMigrations = async function () {
  // using direct mongodb calls to bypass mongoose type cast/validation
  let legacy_migrations = await this.find({ app: { $exists: false } }).lean(true);

  for (let obj of legacy_migrations) {
    obj.app = obj._id;
    delete obj._id;

    await this.collection.insertOne(obj);
    await this.collection.deleteOne({ _id: obj.app });
  }

  // TODO: move to mongoose index
  await this.collection.createIndex({ app: 1 }, { unique: true });
};

// Returns hash of (application_name, [migration_file_names])
//
Migration.statics.getLastState = function () {
  return this.find({}).then(docs => {
    let last_state = {};

    for (let i = 0; i < docs.length; i++) {
      last_state[docs[i].app] = docs[i].steps;
    }

    return last_state;
  });
};

//  checkMigrations(currentMigrations) -> Array
//  - currentMigrations (Array): array of already used migrations
//    `{ <appName> : [ <step>, ... ], ... }`
//
//  Compare `currentMigrations` with available and returns an array of
//  outstanding migrations as an array of _migrations_.
//
//  ##### Migration
//
//  - **appName**:      module name
//  - **step**:         migration step name
//  - **up(callback)**: runs migration up
//
Migration.statics.checkMigrations = function (N, currentMigrations) {

  let MIGRATIONS_DIR = 'db/migrate';

  // returns list of migration files for an application
  //
  function findMigrations(app) {

    return glob('**/*.js', {
      cwd: path.join(app.root, MIGRATIONS_DIR)
    })
    .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name)) // Filter ignored
    .filter(name => /\d{14}_\w*\.js$/.test(name))     // Match migration names
    .map(name => path.basename(name));
  }


  let pending = [];

  currentMigrations = currentMigrations || {};

  N.apps.forEach(app => {
    let appMigrations = currentMigrations[app.name] || [];

    findMigrations(app).forEach(step => {
      if (appMigrations.indexOf(step) === -1) {
        pending.push({
          app,
          step,
          appName:  app.name,
          filename: path.join(app.root, MIGRATIONS_DIR, step)
        });
      }
    });
  });

  // Sort the resulting list by base filenames.
  // That names start with a timestamp, so we'll get the right order.
  return _.sortBy(pending, 'step');
};


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.after('init:models', { priority: 999 }, function migrations_init(N) {
    N.models.Migration = Mongoose.model('migrations', Migration);
  });

  N.wire.after('init:models', { priority: 999 }, async function migrations_check(N) {
    await N.models.Migration.updateMigrations();

    let currentMigrations = await N.models.Migration.getLastState();

    if (N.models.Migration.checkMigrations(N, currentMigrations).length > 0) {
      throw "Can't start: database changed. Please, run `migrate --all` command";
    }

    N.logger.info('Checked DB migrations');
  });
};
