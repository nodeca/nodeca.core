"use strict";


/*global nodeca, _*/


// 3rd-party
var async   = require('nlib').Vendor.Async;
var fstools = require('nlib').Vendor.FsTools;


////////////////////////////////////////////////////////////////////////////////


/**
 *
 *  RESULTING STRUCTURE
 *
 *    .
 *    ├╴ assets/
 *    │  ├╴ <theme>/
 *    │  │  ├╴ <namespace>/
 *    │  │  │  ├╴ app.css
 *    │  │  │  ├╴ app.js
 *    │  │  │  ├╴ *.*
 *    │  │  │  ╰╴ ...
 *    │  │  ╰╴ ...
 *    │  ╰╴ ...
 *    │
 *    ├╴ system/
 *    │  ├╴ <namespace>/
 *    │  │  ├╴ i18n/
 *    │  │  │  ╰╴ <locale>.js
 *    │  │  ╰╴ api.js
 *    │  ╰╴ ...
 *    │
 *    ├╴ views/
 *    │  ├╴ <locale>/
 *    │  │  ├╴ <theme>/
 *    │  │  │  ├╴ <namespace>/
 *    │  │  │  │  ├╴ *.*
 *    │  │  │  │  ╰╴ ...
 *    │  │  │  ╰╴ ...
 *    │  │  ╰╴ ...
 *    │  ╰╴ ...
 *    │
 *    ├╴ compiled/views/
 *    │  ╰╴ <locale>/
 *    │     ├╴ <theme>/
 *    │     │  ├╴ <namespace>/
 *    │     │  │  ├╴ *.js
 *    │     │  │  ╰╴ ...
 *    │     │  ╰╴ ...
 *    │     ╰╴ ...
 *    │
 *    ╰╴ bundle/
 *       │  # Contains:
 *       │  # - `<namespace>/i18n/<locale>js`
 *       │  # - `<locale>/<theme>/<namespace>.js`
 *       │  # - `<namespace>/api.js`
 *       │  # - `<namespace>/app.js
 *       ├╴ app-<locale>-<theme>-<namespace>.js
 *       ╰╴ ...
 *
 **/

////////////////////////////////////////////////////////////////////////////////


module.exports = function (next) {
  var tmp, environment;

  try {
    tmp = fstools.tmpdir('/tmp/nodeca.XXXXX');
  } catch (err) {
    next(err);
    return;
  }

  // schedule files cleanup upon normal exit
  process.on('exit', function (code) {
    if (0 !== +code) {
      console.warn("Unclean exit. Bundled files left in '" + tmp + "'");
      return;
    }

    try {
      console.warn("Removing '" + tmp + "'...");
      fstools.removeSync(tmp);
    } catch(err) {
      console.warn("Failed remove '" + tmp + "'... " + String(err));
    }
  });

  async.series([
    async.apply(fstools.mkdir, tmp),
    async.apply(require('./assets/build_api_tree'), tmp),
    async.apply(require('./assets/build_i18n_files'), tmp),
    async.apply(require('./assets/process_skinner'), tmp),
    async.apply(require('./assets/localize_views'), tmp),
    async.apply(require('./assets/compile_views'), tmp),
    async.apply(require('./assets/mincer'), tmp)
  ], function (err/*, results*/) {
    next(err);
  });
};
