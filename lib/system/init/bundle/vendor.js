'use strict';


var fs      = require('fs');
var fstools = require('fs-tools');
var path    = require('path');
var _       = require('lodash');
var ejs     = require('ejs');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE = fs.readFileSync(path.join(__dirname, 'vendor', 'template.js.ejs'), 'utf8');


////////////////////////////////////////////////////////////////////////////////


function processVendorFiles(sandbox) {
  _.each(sandbox.config.packages, function (pkgConfig, pkgName) {
    var outfile = path.join(sandbox.tmpdir, 'vendor', pkgName + '.js');

    fstools.mkdirSync(path.dirname(outfile));

    // File must be created even if package has no vendor section.
    fs.writeFileSync(outfile, '', 'utf8');

    _.each(pkgConfig.vendor || {}, function (vendorPath, vendorName) {
      var result;

      if (!fs.existsSync(vendorPath)) {
        throw new Error('Vendor file "' + vendorPath + '" does not exists');
      }

      result = ejs.render(TEMPLATE, {
        name:   JSON.stringify(vendorName)
      , root:   JSON.stringify(path.dirname(vendorPath))
      , source: fs.readFileSync(vendorPath, 'utf8')
      });

      fs.appendFileSync(outfile, result, 'utf8');
    });
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox, callback) {
  try {
    processVendorFiles(sandbox);
    callback();
  } catch (err) {
    callback(err);
  }
};
