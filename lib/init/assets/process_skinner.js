'use strict';


/*global nodeca*/


// 3rd-party
var _         = require('nlib').Vendor.Underscore;
var skinner   = require('nlib').Skinner;


////////////////////////////////////////////////////////////////////////////////


// processSkinner(root, callback(err)) -> Void
// - root (String): Pathname where views are placed
// - callback (Function): Executed once everything is done.
//
// Process theme inheritance, apply patches.
//
module.exports = function processSkinner(root, callback) {
  var roots = [], skins = [];

  // prepare list of root dirs
  _.each(nodeca.runtime.apps, function (app) {
    roots.push(app.root);
  });

  // prepare list of theme configs
  _.each(nodeca.config.theme_schemas, function (config, id) {
    skins.push({
      id:         id,
      paths:      {assets: 'assets/' + id, views: 'views/' + id},
      parent_id:  config.inherits
    });
  });

  skinner.process(roots, skins, root, callback);
};
