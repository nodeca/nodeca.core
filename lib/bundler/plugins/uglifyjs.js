'use strict';


const UglifyJS = require('uglify-js');


module.exports = function (context, callback) {
  let result = UglifyJS.minify(context.asset.source, {
    fromString: true
  });

  context.asset.source = result.code;
  callback();
};
