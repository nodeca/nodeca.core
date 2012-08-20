'use strict';


/*global nodeca*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var fstools   = require('nlib').Vendor.FsTools;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (root, callback) {
  var views_path = path.join(root, 'views'),
      orig_path  = views_path + '-orig';

  async.series([
    async.apply(fstools.move, views_path, orig_path),
    async.apply(views.localize, orig_path, views_path,
                nodeca.runtime.i18n, nodeca.config.locales.enabled),
    async.apply(fstools.remove, orig_path)
  ], function (err/*, result*/) {
    callback(err);
  });
};
