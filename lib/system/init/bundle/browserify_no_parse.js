'use strict';


// Modules that don't use require
module.exports = [
  'lodash',
  'jquery',
  'knockout',
  'codemirror'
].map(name => require.resolve(name));
