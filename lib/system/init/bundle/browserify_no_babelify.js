'use strict';


const path = require('path');


// Modules that don't use ES2015
module.exports = [
  'lodash',
  'jquery',
  'codemirror',
  'knockout',
  'codemirror',
  'markdown-it'
].map(name => path.dirname(require.resolve(name)));
