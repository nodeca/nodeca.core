// 'webworkify' package replacement, needed because we have
// different bundling format
//

'use strict';

/* global arguments, Blob, Worker, window */

var _ = require('lodash');

var modules = arguments[4];

// require function for web worker
//
function requireModule(path) {

  var moduleInfo = modules[path];

  if (!moduleInfo) {
    throw new Error('Web worker error: failed to require module "' + path + '"');
  }

  /* global self */

  if (!moduleInfo.initialized) {
    moduleInfo.func.call(
      self, // web worker object name, similar to `window`
      requireModule,
      moduleInfo.internal,
      moduleInfo.internal.exports
    );
    moduleInfo.initialized = true;
  }

  return moduleInfo.internal.exports;
}


// Get paths of dependencies for module by path (recursive)
//
function findDependencies(modulePath) {
  var result = [];

  if (!modules[modulePath]) {
    return result;
  }

  result.push(modulePath);

  modules[modulePath].dependencies.forEach(function (depPath) {
    result = result.concat(findDependencies(depPath));
  });

  return result;
}


// Create web worker src code
//
var getWorkerSrc = _.memoize(function (fn) {

  // Try find module by 'fn' to determine dependencies
  var module = _.find(modules, function (module) {
    if (module.internal.exports === fn) {
      return true;
    }
    return false;
  });

  var deps = [];

  if (module) {

    // Find all module dependencies
    module.dependencies.forEach(function (depPath) {
      deps = deps.concat(findDependencies(depPath));
    });
  }

  var tpl = '' +
    '(function(modules) {' +
    '  var require = <%= requireFn %>;' +
    '  (<%= workerFn %>)(self);' +
    '})({' +
    '  <% _.forEach(dependencies, function(depPath, i) { %>' +
    '    "<%= depPath %>": { "func": <%= modules[depPath].func.toString() %>, "internal": { "exports": {} } }' +
    '    <% if (dependencies.length - 1 !== i) { %>, <% } %>' +
    '  <% }); %>' +
    '});';

  return _.template(tpl, {
    requireFn: requireModule.toString(),
    workerFn: fn.toString(),
    dependencies: deps,
    modules: modules
  });
});


// Create web worker
//
module.exports = function (fn) {
  return new Worker(window.URL.createObjectURL(
    new Blob([ getWorkerSrc(fn) ], { type: 'text/javascript' })
  ));
};
