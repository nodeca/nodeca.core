'use strict';


/*global nodeca*/


// stdlib
var path  = require('path');


// 3rd-party
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var fstools   = require('nlib').Vendor.FsTools;


////////////////////////////////////////////////////////////////////////////////


// localizeViews(root, callback(err)) -> Void
// - root (String): Pathname where to read original and save localized views to.
// - callback (Function): Executed once everything is done.
//
// Localizes all views found under `<root>/views` and stores them under
// `<root>/views/<locale>`.
//
module.exports = function localizeViews(root, callback) {
  var views_path = path.join(root, 'views'),
      orig_path  = views_path + '-orig';

  async.series([
    async.apply(fstools.move, views_path, orig_path),
    async.apply(views.localize, orig_path, views_path,
                nodeca.runtime.i18n, nodeca.config.locales.enabled),
    async.apply(fstools.remove, orig_path)
  ], function (err/*, result */) {
    callback(err);
  });
};
