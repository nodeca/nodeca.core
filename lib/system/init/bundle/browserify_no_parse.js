'use strict';


// Modules that don't use require
module.exports = [
  'jquery',
  'knockout',
  'codemirror'
].map(name => require.resolve(name));
