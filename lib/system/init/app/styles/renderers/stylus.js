'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var stylus      = require('stylus');
var Normalizer  = require('stylus/lib/visitor/normalizer');
var nib         = require('nib');


////////////////////////////////////////////////////////////////////////////////


var FUNCS_PATH = path.join(path.dirname(require.resolve('stylus/package.json')),
                           'lib', 'functions');


////////////////////////////////////////////////////////////////////////////////


function Renderer(str, options, resolve) {
  options = options || {};

  options.globals   = {};
  options.functions = {};
  options.imports   = [FUNCS_PATH];
  options.paths     = options.paths || [];
  options.filename  = options.filename || 'stylus';

  this.options  = options;
  this.str      = str;
  this.resolve  = resolve;

  this.use(nib());
}


Renderer.prototype.set = function(key, val){
  this.options[key] = val;
  return this;
};


Renderer.prototype.get = function(key){
  return this.options[key];
};


Renderer.prototype.include = function(path){
  this.options.paths.push(path);
  return this;
};


Renderer.prototype.use = function(fn){
  fn.call(this, this);
  return this;
};


Renderer.prototype.define = function(name, fn, raw){
  fn = stylus.utils.coerce(fn);

  if (fn.nodeName) {
    this.options.globals[name] = fn;
    return this;
  }

  // function
  this.options.functions[name] = fn;

  if (undefined !== raw) {
    fn.raw = raw;
  }

  return this;
};


Renderer.prototype.import = function(file){
  file = this.resolve(file);
  this.options.imports.push(file);
  return this;
};


Renderer.prototype.render = function (fn) {
  var
  resolve = this.resolve,
  lookup  = stylus.utils.lookup,
  parser  = new stylus.Parser(this.str, this.options);

  parser.import = function () {
    var expr;

    this.expect('import');
    this.allowPostfix = true;

    expr = this.expression();

    expr.nodes.forEach(function (o) {
      console.log(o);

      o.val     = resolve(o.val);
      o.string  = resolve(o.string);

      console.log(o);
    });

    return new stylus.nodes.Import(expr);
  };

  stylus.utils.lookup = function (path, paths, ignore){
    return lookup(resolve(path), paths, ignore);
  };

  try {
    var ast, normalizer, compiler, css;

    stylus.nodes.filename = this.options.filename;

    // parse
    ast = parser.parse();

    // evaluate
    this.evaluator = new stylus.Evaluator(ast, this.options);
    ast = this.evaluator.evaluate();

    // normalize
    normalizer = new Normalizer(ast, this.options);
    ast = normalizer.normalize();

    // compile
    compiler = new stylus.Compiler(ast, this.options);
    css = compiler.compile();

    fn(null, css);
  } catch (err) {
    fn(stylus.utils.formatException(err, {
      input:    err.input     || this.str,
      filename: err.filename  || this.options.filename,
      lineno:   err.lineno    || parser.lexer.lineno
    }));
  } finally {
    stylus.utils.lookup = lookup;
  }
};


////////////////////////////////////////////////////////////////////////////////


module.exports = function (pathname, options, callback) {
  pathname.read(function (err, str) {
    var renderer;

    if (err) {
      callback(err);
      return;
    }

    renderer = new Renderer(str, {
      paths:    [pathname.dirname],
      filename: String(pathname),
    }, function resolve(filename) {
      var
      match     = String(filename).match(/^@([^\/]+)?\/(.+)$/),
      pkgName   = null,
      config    = null,
      files     = null,
      tmp       = null,
      re        = null;

      if (match) {
        pkgName = match[1] || options.pkgName;
        config  = (options.packages[pkgName] || {}).styles || {};
        files   = (config.files || []).map(function (p) { return String(p); });

        if (!path.extname(match[2])) {
          match[2] += ".styl";
        }

        re = new RegExp(match[2] + '$');

        while (files.length) {
          tmp = files.shift();

          if (re.test(tmp)) {
            return tmp;
          }
        }
      }

      return filename;
    });

    renderer.render(callback);
  });
};
