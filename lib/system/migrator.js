// Internal methods to run migrations used by migrate CLI script and migration
// validation filter


'use strict';


/*global N*/


// stdlib
var path = require('path');


// 3rd-party
var fstools = require('fs-tools');


////////////////////////////////////////////////////////////////////////////////


var MIGRATIONS_DIR = 'db/migrate';


////////////////////////////////////////////////////////////////////////////////


// returns list of migration files for an application
function findMigrations(app) {
  var dirname = path.join(app.root, MIGRATIONS_DIR);
  return fstools.findSorted(dirname, /\d{14}_\w*\.js$/).map(path.basename);
}


// Single migration representation
function Migration(app, step) {
  this.app  = app;
  this.step = step;
}


// internal: appName getter
Object.defineProperty(Migration.prototype, 'appName', {
  get: function () { return this.app.name; }
});


// internal: return full filename of migration script
Object.defineProperty(Migration.prototype, 'filename', {
  get: function () {
    return path.join(this.app.root, MIGRATIONS_DIR, this.step);
  }
});


// public: runs migartion and fires `callback(err)` at the end
Migration.prototype.up = function (callback) {
  require(this.filename).up(callback);
};


////////////////////////////////////////////////////////////////////////////////


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
exports.checkMigrations = function checkMigrations(currentMigrations) {
  var delta = [];

  currentMigrations = currentMigrations || {};

  N.runtime.apps.forEach(function (app) {
    var appMigrations = currentMigrations[app.name] || [];

    findMigrations(app).forEach(function (step) {
      if (-1 === appMigrations.indexOf(step)) {
        delta.push(new Migration(app, step));
      }
    });
  });

  return delta;
};
