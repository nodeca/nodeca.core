"use strict";


/*global nodeca, _*/


// stdlib
var fs   = require('fs');
var path = require('path');


// 3rd-party
var Mincer = require('mincer');
var nib    = require('nib');


// internal
var environment = require('./mincer/environment');
var bundle      = require('./mincer/bundle');
var manifest    = require('./mincer/manifest');
var namespaces  = require('./namespaces');


////////////////////////////////////////////////////////////////////////////////


//
// set custom logger for the Mincer
//

Mincer.logger.use(nodeca.logger.getLogger('system'));

//
// Add some funky stuff to Stylus
//

Mincer.StylusEngine.registerConfigurator(function (style) {
  style.use(nib());
  style.define('import-dir', require('./mincer/stylus/import-dir'));
});


////////////////////////////////////////////////////////////////////////////////


module.exports = function mincer(root, callback) {
  var env           = environment.configure(root),
      manifest_root = path.join(nodeca.runtime.apps[0].root, 'public', 'assets');

  bundle.compile(root, env, function (err, distribution) {
    if (err) {
      callback(err);
      return;
    }

    //
    // make environment static
    //

    env = env.index;

    //
    // compile assets
    //

    manifest.compile(manifest_root, env, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      nodeca.runtime.assets = {
        environment:  env,
        manifest:     data,
        map:          distribution
      };

      callback();
    });
  });
};
