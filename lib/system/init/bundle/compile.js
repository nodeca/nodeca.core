'use strict';


module.exports = function (sandbox, callback) {
  sandbox.bundler.compile(function (err, files) {
    if (err) {
      callback(err);
      return;
    }

    sandbox.files = files;

    callback();
  });
};
