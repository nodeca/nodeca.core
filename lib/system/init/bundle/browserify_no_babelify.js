'use strict';


const path = require('path');


// Modules that don't use ES2015
module.exports = [
  'lodash',
  'jquery',
  'codemirror',
  'knockout',
  'codemirror/mode/markdown/markdown',
  'markdown-it',
  'markdown-it-container',
  'markdown-it-emoji',
  'markdown-it-footnote',
  'markdown-it-sub',
  'markdown-it-sup'
].map(name => path.dirname(require.resolve(name)));
