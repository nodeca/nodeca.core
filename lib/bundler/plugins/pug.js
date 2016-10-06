'use strict';


const Promise = require('bluebird');


module.exports = function (context) {

  return Promise.resolve().then(() => {
    const pug = require('pug');

    let tpl = pug.compileClient(context.asset.source, {
      // debug decrease speed and disable external cache
      // (injects unique paths every time, because of random tml dir)
      compileDebug: false,
      // NO `with` -> better speed
      self: true,
      // Set HTML5 mode, for terse attributes (boolean + without params)
      doctype: 'html',
      // Use helpers from outer module
      inlineRuntimeFunctions: false,
      // For error reporting
      filename: context.asset.logicalPath
    }).toString();

    context.asset.source = tpl;
  });
};
