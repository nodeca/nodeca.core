"use strict";


/*global nodeca, _*/


// stdlib
var fs        = require('fs');
var path      = require('path');
var resolve   = path.resolve;
var exists    = fs.existsSync || path.existsSync;
var join      = path.join;
var basename  = path.basename;


// 3rd-party
var async   = require('nlib').Vendor.Async;
var Mocha   = require('mocha');


////////////////////////////////////////////////////////////////////////////////

// Lookup file names at the given `path`.
//
function lookupFiles(path, recursive) {
  var files = [], stat;

  if (!exists(path)) {
    path += '.js';
  }

  try {
    stat = fs.statSync(path);
  } catch (err) {
    return files;
  }

  if (stat.isFile()) {
    return path;
  }

  fs.readdirSync(path).forEach(function(file){
    file = join(path, file);

    var stat = fs.statSync(file);

    if (stat.isDirectory()) {
      if (recursive) {
        files = files.concat(lookupFiles(file, recursive));
      }

      return;
    }

    if (!stat.isFile() || !(/\.js$/).test(file) || '.' === basename(file)[0]) {
      return;
    }

    files.push(file);
  });

  return files;
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


// starts all found tests
//
module.exports = function (callback) {
  var mocha = new Mocha(), files = [];

  mocha.reporter('spec');
  mocha.ui('bdd');

  _.each(nodeca.runtime.apps, function (app) {
    files = files.concat(lookupFiles(app.root + '/test', true));
  });

  mocha.files = files.map(function (path) {
    return resolve(path);
  });

  mocha.run(callback);
};
