'use strict';


// Modules that don't use require
module.exports = [
  'lodash',
  'jquery',
  'knockout'
].map(name => require.resolve(name));
