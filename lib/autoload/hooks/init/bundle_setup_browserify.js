// Setup browserify options `no_parse` and `no_babelify`
//
'use strict';


// Modules that don't use require
const NO_PARSE = [
  'jquery',
  'knockout',
  'codemirror'
].map(name => require.resolve(name));

// Modules that don't use ES2015
const NO_BABELIFY = [
  'lodash',
  'jquery',
  'knockout',
  'codemirror',
  'markdown-it'
].map(name => require.resolve(name));


module.exports = function (N) {
  N.wire.after('init:bundle.setup', function bundle_setup_browserify(sandbox) {
    sandbox.browserify = {
      no_parse: NO_PARSE,
      no_babelify: NO_BABELIFY
    };
  });
};
