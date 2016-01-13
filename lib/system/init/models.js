// Populates N.models tree
//


'use strict';


var path    = require('path');
var fstools = require('fs-tools');
var apify   = require('./utils/apify');


////////////////////////////////////////////////////////////////////////////////


// Denormalizes and expands flat tree:
//
//    var o = { 'foo.bar': 1, boo: 2 };
//
//    expandTree(o); // -> { foo: { bar: 1 }, 'foo.bar': 1, boo: 2 };
//
//    o.foo.bar === o['foo.bar'];
//
function expandTree(obj) {
  Object.keys(obj)
    .sort()
    .filter(key => { return key.indexOf('.') >= 0; })
    .forEach(key => {
      let tmp = obj,
          parts = key.split('.');

      while (parts.length > 1) {
        let k   = parts.shift();
        tmp = (tmp[k] = tmp[k] || {});
      }

      tmp[parts.pop()] = obj[key];
    });
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.models = {};

  // Load models, and leave them for lazy-init
  N.apps.forEach(app => {
    let modelsRoot = path.join(app.root, 'models');

    fstools.walkSync(modelsRoot, /\.js$/, file => {
      // skip "hidden" files (name/dir starts with underscore)
      if (file.match(/(^|\/|\\)_/)) { return; }

      // It can throw excepthin, that will be catched in runner
      require(file)(N, apify(file, modelsRoot));
    });
  });


  // Beautify API tree
  //
  N.wire.after('init:models', function models_init_done(N) {
    expandTree(N.models);
    N.logger.info('Models init done');
  });
};
