// Utility functions
//
'use strict';

const Promise = require('bluebird');


function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  /*istanbul ignore if*/
  if (!constructor) {
    return false;
  }
  if (constructor.name === 'GeneratorFunction' ||
      constructor.displayName === 'GeneratorFunction') {
    return true;
  }
  return false;
}


module.exports.toPromiseFn = function (fn, maxLength) {
  if (isGeneratorFunction(fn)) {
    return Promise.coroutine(fn);
  }

  if (fn.length <= maxLength) {
    return function sync_wrapper() {
      var result;

      try {
        result = fn.apply(this, arguments);
      } catch (err) {
        return Promise.reject(err);
      }

      return Promise.resolve(result);
    };
  }

  return function async_wrapper() {
    var self = this;
    var args = Array.prototype.slice.call(arguments);

    return new Promise(function (resolve, reject) {
      args.push(function (err, args) {
        if (err) {
          reject(err);
        } else {
          resolve(args);
        }
      });

      try {
        fn.apply(self, args);
      } catch (err) {
        reject(err);
      }
    });
  };
};
