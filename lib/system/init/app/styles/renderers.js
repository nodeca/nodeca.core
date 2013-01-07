'use strict';


module.exports = {
  '.css':   require('./renderers/css'),
  '.less':  require('./renderers/less'),
  '.styl':  require('./renderers/stylus')
};
