'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var stylus  = require('stylus');
var nib     = require('nib');


////////////////////////////////////////////////////////////////////////////////


var FUNCS_PATH = path.join(path.dirname(require.resolve('stylus/package.json')),
                           'lib', 'functions');


////////////////////////////////////////////////////////////////////////////////


stylus.Parser.prototype.import = function () {
  var expr = this.expression();

  this.expect('import');
  this.allowPostfix = true;

  return new stylus.nodes.Import();
};



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
  parser  = new stylus.Parser(this.str, this.options);

  parser.import = function () {
    var expr;

    this.expect('import');
    this.allowPostfix = true;

    expr = this.expression();
    expr = resolve(expr);

    return new stylus.nodes.Import(expr);
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
    normalizer = new stylus.Normalizer(ast, this.options);
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
      roots     = null,
      tmp       = null;

      if (match) {
        pkgName = match[1] || options.pkgName;
        config  = (options.packages[pkgName] || {}).styles;
        roots   = (config || []).map(function (o) { return o.root; });

        while (roots.length) {
          tmp = path.join(roots.shift(), match[2]);
          if (fs.existSync(tmp)) {
            return tmp;
          }
        }
      }

      return filename;
    });

    renderer.render(callback);
  });
};
