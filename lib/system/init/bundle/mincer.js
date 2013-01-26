// Prepres Mincer environent and saves it as sandbox.assets.environment
//


"use strict";


/*global N*/


// stdlib
var path = require('path');


// 3rd-party
var Mincer = require('mincer');
var nib    = require('nib');


// internal
var compression = require('./mincer/compression');


////////////////////////////////////////////////////////////////////////////////


//
// set custom logger for the Mincer
//

Mincer.logger.use(N.logger.getLogger('system'));

//
// Add some funky stuff to Stylus
//

Mincer.StylusEngine.registerConfigurator(function (style) {
  style.use(nib());
  style.define('import-dir', require('./mincer/stylus/import-dir'));
});


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var environment = new Mincer.Environment(tmpdir);

  //
  // Provide some helpers to EJS and Stylus
  //

  environment.ContextClass.defineAssetPath(function (pathname, options) {
    var asset = environment.findAsset(pathname, options);
    return !asset ? null : ("/assets/" + asset.digestPath);
  });

  //
  // Add jetson serializer helper
  //

  environment.registerHelper('jetson', require('../../jetson').serialize);

  //
  // fill in 3rd-party modules paths
  //

  environment.appendPath(path.resolve(__dirname, '../../../../../pointer/browser'));
  environment.appendPath(path.resolve(__dirname, '../../../../../babelfish/browser'));

  //
  // Set JS/CSS compression if it was not explicitly disabled
  // USAGE: SKIP_ASSETS_COMPRESSION=1 ./nodeca.js server
  //

  if (!process.env.SKIP_ASSETS_COMPRESSION) {
    environment.jsCompressor  = compression.js;
    environment.cssCompressor = compression.css;
  }

  sandbox.assets = {
    environment:  environment,
    // holds list of assets to be bundled by mincer
    files:        []
  };

  callback();
};
