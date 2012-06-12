'use strict';


// stdlib
var path = require('path');
var fs = require('fs');


// 3rd-party
var stylus = require('stylus');


////////////////////////////////////////////////////////////////////////////////


function find_files(pathname) {
  var files = [];

  fs.readdirSync(pathname).forEach(function (filename) {
    filename = path.join(pathname, filename);

    if (fs.statSync(filename).isDirectory()) {
      files = files.concat(find_files(filename));
      return;
    }

    files.push(filename);
  });

  return files.sort();
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function import_tree(expr) {
  var block     = this.currentBlock,
      vals      = [stylus.nodes['null']],
      pathname  = path.resolve(path.dirname(this.filename), expr.val);

  find_files(pathname).forEach(function (file) {
    var expr = new stylus.nodes.Expression(),
        node = new stylus.nodes.String(file),
        body;

    expr.push(node);

    body = this.visitImport(new stylus.nodes.Import(expr));
    vals = vals.concat(body.nodes);
  }, this);

  this.mixin(vals, block);
  return vals;
};
