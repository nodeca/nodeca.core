'use strict';


// 3rd-party
var less  = require('less');


////////////////////////////////////////////////////////////////////////////////


// helper to generate human-friendly errors.
// adapted version from original bin/less
function lessError(ctx) {
  var message = "";
  var extract = ctx.extract;
  var error   = [];

  if (ctx.stack || !ctx.hasOwnProperty('index')) { return ctx; }

  if (typeof(extract[0]) === 'string') {
    error.push((ctx.line - 1) + ' ' + extract[0]);
  }

  if (extract[1]) {
    error.push(ctx.line + ' ' +
               extract[1].slice(0, ctx.column) +
               extract[1][ctx.column] +
               extract[1].slice(ctx.column + 1));
  }

  if (typeof(extract[2]) === 'string') {
    error.push((ctx.line + 1) + ' ' + extract[2]);
  }

  error   = error.join('\n');
  message = ctx.type + 'Error: ' + ctx.message;

  if (ctx.filename) {
    message += ' in ' + ctx.filename + ':' + ctx.line + ':' + ctx.column;
  }

  return new Error(message + '\n---\n' + error);
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (pathname, callback) {
  pathname.read(function (err, str) {
    var parser;

    if (err) {
      callback(err);
      return;
    }

    parser = new (less.Parser)({
      paths:          [pathname.dirname],
      filename:       String(pathname),
      optimization:   1,
      strictImports:  false
    });

    parser.parse(str, function (err, tree) {
      if (err) {
        callback(lessError(err));
        return;
      }

      try {
        callback(null, tree.toCSS());
      } catch (err) {
        callback(lessError(err));
      }
    });
  });
};
