//  Takes array of applications, each one should have `root` property,
//  and returns a config object with resolved and found pathnames:
//
//      bundles:
//        frontend:
//          - lib
//          - forum
//          - blogs
//
//        backend:
//          - lib
//          - admin
//
//      packages:
//        forum:
//          styles:
//            main: ...
//            lookups:
//              - /home/ixti/Projects/nodeca/node_modules/nodeca.forum/client/forum
//              - /home/ixti/Projects/nodeca/node_modules/nodeca.users/client/forum
//            files:
//              - /home/ixti/Projects/nodeca/node_modules/nodeca.forum/client/forum/foo.styl
//              - /home/ixti/Projects/nodeca/node_modules/nodeca.users/client/forum/bar.styl
//              ...
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _     = require('lodash');
var async = require('async');


// internal
var resolveModulePath = require('./resolve_module_path');
var findPaths         = require('./find_paths');
var Pathname          = require('./pathname');


// constants
var FILE_COLLECTOR_CONFIG_SECTIONS = [
  'bin'
, 'server'
, 'client'
, 'views'
, 'styles'
, 'i18n_client'
, 'i18n_server'
];


////////////////////////////////////////////////////////////////////////////////


// Takes a root path and an array of vendor package declarations and returns a
// mapping of module identifiers to absolute paths for the given packages using
// `resolveModulePath` function.
function resolveVendorFiles(rootDir, vendorList) {
  var result = {};

  _.forEach(vendorList || [], function (vendorPkg) {
    var asPair, depName, depPath;

    if (_.isPlainObject(vendorPkg)) {
      asPair = _.pairs(vendorPkg);

      if (1 !== asPair.length) {
        throw 'Ill-formed list of vendor packages.';
      }

      depName = asPair[0][0];
      depPath = asPair[0][1];
    } else {
      depName = depPath = vendorPkg;
    }

    result[depName] = resolveModulePath(rootDir, depPath);
  });

  return result;
}


function prepareConfig(apps) {
  var config = { packages: {}, bundles: {} };

  _.each(apps, function (app) {
    var
    app_config_file = path.join(app.root, 'bundle.yml'),
    app_config      = null;

    if (fs.existsSync(app_config_file)) {
      app_config = require(app_config_file);

      if (app_config.packages) {
        _.each(app_config.packages, function (pkgConfig, pkgName) {
          if (!config.packages[pkgName]) {
            config.packages[pkgName] = {};
          }

          // merge dependences
          config.packages[pkgName].depends =
            _.union((config.packages[pkgName].depends || []),
                    (pkgConfig.depends                || []));

          // merge vendor package declarations
          config.packages[pkgName].vendor =
            _.extend((config.packages[pkgName].vendor || {}),
                     resolveVendorFiles(app.root, pkgConfig.vendor));

          // merge common resource declarations
          _(pkgConfig).pick(FILE_COLLECTOR_CONFIG_SECTIONS).each(function (sectionConfig, sectionName) {
            var c, lookup;

            if (!config.packages[pkgName][sectionName]) {
              config.packages[pkgName][sectionName] = { lookup: [] };
            }

            // shortcut
            c = config.packages[pkgName][sectionName];

            // do not allow more than one main per package/section
            if (c.main && sectionConfig.main) {
              throw "Duplicate `main` file for " + sectionName +
                    " of " + pkgName + " package in " + app.name;
            }

            // prepare lookup config
            lookup = _.pick(sectionConfig, 'include', 'exclude');

            // provide some calculated values
            lookup.root       = path.resolve(app.root, sectionConfig.root);
            lookup.appRoot    = app.root;
            lookup.apiPrefix  = pkgName;

            // set main file if it wasn't set yet
            if (sectionConfig.main) {
              c.main = new Pathname(path.resolve(lookup.root, sectionConfig.main), {
                relative: sectionConfig.main
              });
            }

            // if apiPrefix was given - use it instead of package name based one
            if (sectionConfig.hasOwnProperty('apiPrefix')) {
              lookup.apiPrefix = sectionConfig.apiPrefix;
            }

            // push lookup config
            c.lookup.push(lookup);
          });
        });
      }

      _.each(app_config.bundles || {}, function (packages, name) {
        if (!config.bundles[name]) {
          config.bundles[name] = [];
        }

        config.bundles[name] = _.union(config.bundles[name], packages);
      });
    }
  });

  // push main into each "lookup" path
  _.each(config.packages, function (pkg) {
    _.each(pkg, function (cfg) {
      if (cfg.main) {
        _.each(cfg.lookup, function (l) {
          l.main = cfg.main;
        });
      }
    });
  });

  // ensure existence of the declared dependences
  _.each(config.packages, function (pkg, name) {
    if (pkg.depends) {
      _.each(pkg.depends, function (dep) {
        if (!config.packages[dep]) {
          throw name + " package depends on a non-existent " + dep + " package";
        }
      });
    }
  });

  return config;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (apps, callback) {
  var config;

  try {
    config = prepareConfig(apps);
  } catch (e) {
    callback(e);
    return;
  }

  // for each package
  async.forEachSeries(_.keys(config.packages), function (pkgName, next) {
    // for each section of a package
    async.forEachSeries(_.keys(config.packages[pkgName]), function (key, next) {
      if (_.contains(FILE_COLLECTOR_CONFIG_SECTIONS, key)) {
        findPaths(config.packages[pkgName][key].lookup, function (err, pathnames) {
          config.packages[pkgName][key].files = pathnames;
          next(err);
        });
      } else {
        next();
      }
    }, next);
  }, function (err) {
    callback(err, config);
  });
};
