// Less renderer
//
'use strict';


var path = require('path');
var less = require('less');


module.exports = function (data, filename) {
  var result;
  var node_modules_abs_path = path.join(path.dirname(require.resolve('less')), '../');

  // Will work synchronous because `syncImport` is true.
  less.render(data, {
    paths: [ path.dirname(filename), node_modules_abs_path ],
    optimization: 1,
    filename,
    syncImport: true
  }, function (err, data) {
    if (err) {
      throw err;
    }

    result = data;
  });

  return result;
};
