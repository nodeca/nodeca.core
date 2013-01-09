// Concats js/css resources per-bundle
//


'use strict';


/*global underscore, N*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _       = underscore;
var async   = require('async');
var fstools = require('fs-tools');


// internal
var stopwatch = require('./utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////


// Returns map of { <locale> : <source>, ... }
//
function concatPackageJavascripts(pkgName, tmpdir, withLocales, callback) {
  // collect package "base" javascripts
  async.map([ 'views', 'client' ], function (part, next) {
    var filename = path.join(tmpdir, part, pkgName + '.js');

    fs.exists(filename, function (exists) {
      if (!exists) {
        next(null, "");
        return;
      }

      fs.readFile(filename, 'utf8', next);
    });
  }, function (err, results) {
    var base, data;

    if (err) {
      callback(err);
      return;
    }

    data = {};
    base = results.join("\n\n");

    if (!withLocales) {
      data['*'] = base;
      callback();
      return;
    }

    async.forEach(N.config.locales['enabled'], function (locale, next) {
      var filename = path.join(tmpdir, 'i18n', pkgName, locale + '.js');

      data[locale] = base;

      fs.exists(filename, function (exists) {
        if (!exists) {
          next();
          return;
        }

        fs.readFile(filename, 'utf8', function (err, str) {
          if (err) {
            next(err);
            return;
          }

          data[locale] += str;
          next();
        });
      });
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, data);
    });
  });
}


// Returns package styesheet string
function readPackageStyles(pkgName, tmpdir, callback) {
  var filename = path.join(tmpdir, "styles", pkgName + ".css");

  fs.exists(filename, function (exists) {
    if (!exists) {
      callback(null, "");
      return;
    }

    fs.readFile(filename, "utf8", callback);
  });
}


// Returns hash with package -> assets:
//
//    {
//      forum: {
//        stylesheet: <String>,
//        javascripts: {
//          "en-US": <String>,
//          ...
//        }
//      }
//    }
//
function collectPackageAssets(tmpdir, sandbox, callback) {
  var data = {};

  async.forEach(_.keys(sandbox.config.packages), function (pkgName, next) {
    var withLocales = !!sandbox.config.packages[pkgName].i18n_client;

    async.series([
      async.apply(readPackageStyles, pkgName, tmpdir),
      async.apply(concatPackageJavascripts, pkgName, !!withLocales, tmpdir)
    ], function (err, results) {
      if (err) {
        next(err);
        return;
      }

      data[pkgName] = _.object(["stylesheet", "javascripts"], results);
      next();
    });
  }, function (err) {
    callback(err, data);
  });
}



// Concat stylesheets from different bundles and writes bundles stylesheet if
// it's non-empty
//
function writeBundleStylesheet(name, tmpdir, sandbox, assets, callback) {
  var
  stylesheet  = "",
  filename    = path.join(tmpdir, "bundle", name + ".css");

  _.each(assets, function (data) {
    stylesheet += data.stylesheet;
  });

  if (!stylesheet) {
    callback();
    return;
  }

  sandbox.assets.files.push(filename);

  fs.writeFile(filename, stylesheet, "utf8", callback);
}


// Concat all javascripts per-bundle / locale
function writeBundleJavascripts(name, tmpdir, sandbox, assets, callback) {
  var withLocales = _.any(assets, function (data) {
    return !!data.javascripts['*'];
  });

  function writeFile(locale) {
    var
    javascript  = "",
    suffix      = (locale ? ('.' + locale) : '') + '.js',
    filename    = path.join(tmpdir, "bundle", name + suffix);

    _.each(assets, function (data) {
      javascript += data.javascripts[locale] || data.javascripts['*'] || '';
    });

    sandbox.assets.files.push(filename);
    fs.writeFileSync(filename, javascript, "utf8");
  }

  if (!withLocales) {
    writeFile();
    callback();
    return;
  }

  N.config.locales["enabled"].forEach(writeFile);
  callback();
}


// Write bundle files
//
//    bundle/<name>.css
//    bundle/<name>.<locale>.js
//
function writeBundle(name, tmpdir, sandbox, assets, callback) {
  async.series([
    async.apply(writeBundleStylesheet, name, tmpdir, sandbox, assets),
    async.apply(writeBundleJavascripts, name, tmpdir, sandbox, assets)
  ], callback);
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (tmpdir, sandbox, callback) {
  var timer = stopwatch();

  fstools.mkdir(path.join(tmpdir, 'bundle'), function (err) {
    if (err) {
      callback(err);
      return;
    }

    collectPackageAssets(tmpdir, sandbox, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      async.forEach(_.keys(sandbox.config.bundles), function (name, next) {
        var assets = _.pick(data, sandbox.config.bundles[name]);
        writeBundle(name, tmpdir, sandbox, assets, next);
      }, function (err) {
        N.logger.debug('Concatenated dynamic assets ' + timer.elapsed);
        callback(err);
      });
    });
  });
};
