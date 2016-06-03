'use strict';


const sass    = require('node-sass');
const path    = require('path');
const Promise = require('bluebird');


module.exports = function (context) {
  let node_modules_abs_path = path.join(path.dirname(require.resolve('nodeca.core')), '../');

  return Promise.fromCallback(cb => {
    sass.render({
      data: context.asset.source,
      includePaths: [ path.dirname(context.asset.logicalPath), node_modules_abs_path ],
      file: context.asset.logicalPath
    }, cb);
  })
  .then(data => {
    context.asset.source = data.css;

    data.stats.includedFiles.forEach(file_path => {
      context.asset.dependOnFile(file_path);
    });
  });
};
