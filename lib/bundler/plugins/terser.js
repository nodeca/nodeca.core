'use strict';


module.exports = async function (context) {
  const terser = require('terser');

  let result = await terser.minify(context.asset.source, {
    // prevent simplifying "browser-pack/prelude.js" when used in a macros
    compress: { expression: true }
  });

  if (result.error) throw result.error;

  // Special case for "browser-pack/prelude.js": if source will be empty after
  // compression - skip compression, because file may be included by macros.
  if (result.code !== '') {
    context.asset.source = result.code;
  }
};
