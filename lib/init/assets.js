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
 *    ╰╴ views_compiled/
 *       ╰╴ <locale>/
 *          ├╴ <theme>/
 *          │  ├╴ <namespace>/
 *          │  │  ├╴ *.js
 *          │  │  ╰╴ ...
 *          │  ╰╴ ...
 *          ╰╴ ...
 *
 **/

////////////////////////////////////////////////////////////////////////////////


module.exports = function (next) {
  var tmp;

  try {
    tmp = fstools.tmpdir('/tmp/nodeca.XXXXX');
  } catch (err) {
    next(err);
    return;
  }

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
