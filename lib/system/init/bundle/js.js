'use strict';


const _          = require('lodash');
const browserify = require('browserify');
const stream     = require('readable-stream');
const path       = require('path');
const babelify   = require('babelify');


const before = _.template(`
NodecaLoader.registerClientModule('<%= apiPath %>', function (N, __, exports, module, t) {`);
const after = '});';


module.exports = function (sandbox, callback) {
  let exclude = [];

  _.forEach(sandbox.config.packages, (pkg) => {
    _.forEach(pkg.vendor, (__, name) => {
      exclude.push(name);
    });
  });


  function browserify_concat_plugin(context, cb) {
    if (!_.trim(context.asset.source, '\n')) {
      cb();
      return;
    }

    let b = browserify({ standalone: 'nodeca' });

    context.asset.__queue__.forEach(file_path => {
      let s = new stream.Transform();
      s.push(context.bundler.findAsset(file_path).source);
      s.end();

      b.add(s, { basedir: path.dirname(file_path) });
    });

    b.transform(babelify, { presets: [ 'es2015' ] });

    exclude.forEach(e => b.exclude(e));

    b.on('file', (path) => {
      context.asset.dependOnFile(path);
    });

    b.bundle((err, out) => {
      if (err) {
        cb(err);
        return;
      }

      context.asset.source = String(out);

      cb();
    });
  }


  _.forEach(sandbox.config.packages, (pkg, pkg_name) => {
    let widget_js = sandbox.bundler.createClass('concat', {
      logicalPath: 'public/package-component-widget-js-' + pkg_name + '.js',
      virtual: true,
      plugins: [ browserify_concat_plugin ]
    });

    _.forEach(pkg.files.widget_js, (file_info) => {
      let asset = sandbox.bundler.createClass('file', {
        logicalPath: file_info.path,
        virtual: true,
        plugins: [ 'load_text', 'macros', 'auto', 'wrapper' ],
        wrapBefore: before({ apiPath: file_info.api_path }),
        wrapAfter: after
      });

      widget_js.push(asset);
    });

    sandbox.component_client[pkg_name].js.push(widget_js);

    _.forEach(pkg.files.js, (file_info) => {
      sandbox.bundler.createClass('file', {
        logicalPath: file_info.path,
        plugins: [ 'load_text', 'auto', 'macros' ]
      });
    });
  });

  callback();
};
