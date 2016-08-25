// Setup browserify options `no_parse`
//
'use strict';


// Modules that don't use require
const NO_PARSE = [
  'jquery',
  'knockout',
  'codemirror'
].map(name => require.resolve(name));


module.exports = function (N) {
  N.wire.after('init:bundle.setup', function bundle_setup_browserify(sandbox) {
    sandbox.browserify = {
      no_parse: NO_PARSE
    };
  });
};
