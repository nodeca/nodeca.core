// Process chared libraries (one should not be duplicated between packages,
// and can have aliases)
// (!!!) This files can't be nested now

'use strict';


var fs      = require('fs');
var fstools = require('fs-tools');
var path    = require('path');
var _       = require('lodash');


////////////////////////////////////////////////////////////////////////////////


var WRAPPER_TEMPLATE_PATH = path.join(__dirname, 'vendor', 'wrapper.tpl');
var WRAPPER_TEMPLATE = _.template(fs.readFileSync(WRAPPER_TEMPLATE_PATH, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox) {
  _.forEach(sandbox.config.packages, function (pkgConfig, pkgName) {
    var outfile = path.join(sandbox.tmpdir, 'vendor', pkgName + '.js')
      , result  = [];

    _.forEach(pkgConfig.vendor, function (vendorPath, vendorName) {
      if (!fs.existsSync(vendorPath)) {
        throw new Error('Vendor file "' + vendorPath + '" does not exists');
      }

      result.push(WRAPPER_TEMPLATE({
        name:   vendorName
      , source: fs.readFileSync(vendorPath, 'utf8')
      }));
    });

    fstools.mkdirSync(path.dirname(outfile));
    fs.writeFileSync(outfile, result.join('\n'), 'utf8');
  });
};
