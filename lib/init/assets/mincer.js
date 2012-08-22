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
  var env     = environment.configure(root),
      output  = path.join(nodeca.runtime.apps[0].root, 'public', 'assets');

  //
  // Collect all possible variants. Each variant is an object with theme,
  // namespace and locale, e.g.:
  // `{ theme: 'desktop', locale: 'en-US', namespace: 'users' }`
  //

  bundle.collect(root, function (err, variants) {
    if (err) {
      callback(err);
      return;
    }

    bundle.process(root, variants, env, function (err) {
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

      manifest.compile(output, env, function (err, data) {
        if (err) {
          callback(err);
          return;
        }

        // server-only struture thet keeps references to:
        // - environment  (used for `asset_inline`)
        // - manifest     (used for `asset_path`)
        // - map          (distribution map for `loadAssets.init`)

        nodeca.runtime.assets = {
          environment:  env,
          manifest:     data,
          map:          bundle.distribute(variants, env)
        };

        callback();
      });
    });
  });
};
