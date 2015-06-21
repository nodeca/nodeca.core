// Read configs, init loggers, init apps, fills N object.


'use strict';


// stdlib
var path = require('path');
var fs   = require('fs');
var crypto = require('crypto');


// 3rd-party
var _           = require('lodash');
var fstools     = require('fs-tools');
var log4js      = require('log4js');
var validator   = require('is-my-json-valid');
var yaml        = require('js-yaml');
var wire        = require('event-wire');


// internal
var Application = require('./application');
var stopwatch   = require('../init/utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}


// merge configs, respecting `~override: true` instructions
function mergeConfigs(dst, src) {
  _.forEach(src || {}, function (value, key) {

    // if destination exists & already has `~override` flag, keep it intact
    if (_.isObject(dst[key]) && dst[key]['~override']) {
      return;
    }

    // if source has `~override` flag - override whole value in destination
    if (value && value['~override']) {
      dst[key] = value;
      return;
    }

    // if both nodes are objects - merge recursively
    if (_.isObject(value) && _.isObject(dst[key])) {
      mergeConfigs(dst[key], value);
      return;
    }

    // destination node does not exist - create
    // or both nodes are of different types - override.
    dst[key] = value;
    return;
  });

  return dst;
}


// reads all *.yml files from `dir` and merge resulting objects into single one
function loadConfigs(root) {
  var config = {},
      files = [];

  fstools.walkSync(root, /[.]yml$/, function (file, stat) {
    if (stat.isFile()) {
      files.push(file);
    }
  });

  // files order can change, but we shuld return the same result always
  files = files.sort();

  _.forEach(files, function (file) {
    mergeConfigs(config, yaml.safeLoad(fs.readFileSync(file, 'utf8'), { filename: file }));
  });

  return config;
}


// Returns an object with keys:
//
//   `responderName` (string)
//   `splittedMethod` (array)
//
// Each one may be `null` which means 'any'.
//
//   'rpc@'             => { responderName: 'rpc',  splittedMethod: null }
//   'http@forum.index' => { responderName: 'http', splittedMethod: [ 'forum', 'index' ] }
//   'blogs'            => { responderName: null,   splittedMethod: [ 'blogs' ] }
//
function parseLoggerName(name) {
  var responderName, splittedMethod, parts = name.split('@');

  if (parts.length === 1) {
    responderName  = null;
    splittedMethod = name.split('.');

  } else if (parts.length === 2) {
    responderName  = parts[0];
    splittedMethod = parts[1].split('.');

  } else {
    // Bad name format. Only one @ symbol is allowed.
    return null;
  }

  if (_.compact(splittedMethod).length === 0) {
    splittedMethod = null;
  }

  return { responderName: responderName, splittedMethod: splittedMethod };
}


////////////////////////////////////////////////////////////////////////////////


// Init `N.wire` with time tracking
//
// override:
//
// - on
// - off
//
function initWire(N) {
  N.wire  = wire();

  var originalOn = N.wire.on.bind(N.wire);

  N.wire.on = function (channels, options, handler) {
    if (!handler) {
      handler = options;
      options = null;
    }

    options = options || {};

    // Keep original handler name
    options.name = handler.name;

    var trackedHandler;

    // If handler async
    if (handler.length === 2) {
      trackedHandler = function (params, callback) {
        // Try find puncher in `params.extras.puncher`
        var puncher = (params.extras && params.extras.puncher) ? params.extras.puncher : null;

        // If puncher not found
        if (!puncher) {
          // Try find in `params.env.extras.puncher`
          puncher = (params.env && params.env.extras && params.env.extras.puncher) ? params.env.extras.puncher : null;
        }

        if (puncher) {
          puncher.start(handler.name);
        }

        handler(params, function (err) {
          if (puncher) {
            puncher.stop();
          }

          callback(err);
        });
      };

    // If handler sync
    } else {
      trackedHandler = function (params) {
        // Try find puncher in `params.extras.puncher`
        var puncher = (params.extras && params.extras.puncher) ? params.extras.puncher : null;

        // If puncher not found
        if (!puncher) {
          // Try find in `params.env.extras.puncher`
          puncher = (params.env && params.env.extras && params.env.extras.puncher) ? params.env.extras.puncher : null;
        }

        if (puncher) {
          puncher.start(handler.name);
        }

        var result = handler(params);

        if (puncher) {
          puncher.stop();
        }

        return result;
      };
    }

    // Keep `trackedHandler` to support `.off`
    handler.__tracked_handler__ = trackedHandler;

    originalOn(channels, options, trackedHandler);
  };

  var originalOff = N.wire.off.bind(N.wire);

  N.wire.off = function (channel, handler) {
    if (handler && handler.__tracked_handler__) {
      originalOff(channel, handler.__tracked_handler__);
      return;
    }

    originalOff(channel, handler);
  };
}


function initScope(N) {

  // provide some empty structures
  N.client  = {};
  N.views   = {};

  // Storage for validators (each key is a `apiPath`)
  var validateFn = {};

  // Additional format extentions
  var validateFormatExt = {
    mongo: /^[0-9a-f]{24}$/
  };

  /**
   *  N.validate(apiPath, schema) -> Void
   *  N.validate(schema) -> Void
   *  - apiPath (String): server api path relative to the current api node
   *  - schema (Object): validation schema (for proprties only)
   *
   *  Add validation schema for params of apiPath.
   *
   *  ##### Schema
   *
   *  You can provide full JSON-Schema compatible object:
   *
   *      {
   *        properties: {
   *          id: { type: 'integer', minimal: 1 }
   *        },
   *        additionalProperties: false
   *      }
   *
   *  But for convenience we provide a syntax suger for this situation, so the
   *  above is long-hand syntax of:
   *
   *      {
   *        id: { type: 'integer', minimal: 1 }
   *      }
   *
   *
   *  ##### Example
   *
   *      // file: server/forum/thread.js
   *
   *      N.validate('server:forum.thread.show', {
   *        properties: {
   *          id: { type: 'integer', minimal: 1 }
   *        },
   *        additionalProperties: false
   *      });
   *
   *      module.exports.show = function (params, callback) {
   *        // ...
   *      };
   **/
  N.validate = function (apiPath, schema) {
    if (!schema || !schema.properties) {
      schema = {
        properties: schema,
        additionalProperties: false
      };
    }

    validateFn[apiPath] = validator(schema, {
      formats: validateFormatExt,
      verbose: true
    });
  };


  /** internal
   *  N.validate.test(apiPath, params) -> Object|Null
   *
   *  Runs revalidate of apiPath for given params. Returns structure with
   *  `valid:Boolean` and `errors:Array` properties or `Null` if apiPath has no
   *  schema.
   **/
  N.validate.test = function (apiPath, params) {
    if (validateFn[apiPath]) {
      if (validateFn[apiPath](params)) {
        return { valid: true, errors: [] };
      }
      return { valid: false, errors: validateFn[apiPath].errors };
    }

    return null;
  };


  /**
   *  N.enviroment -> String
   *
   *  Proxy to process.env['NODECA_ENV']
   **/
  N.enviroment = process.env.NODECA_ENV || 'development';
}


function initConfig(N) {
  var mainRoot = N.mainApp.root,
      mainConfig  = {};

  //
  // Create empty object that we'll fill in a second
  //

  N.config = {};

  //
  // Start reading configs:
  // - Main app config stored into mainConfig
  // - Sub-apps configs got merged into N.config
  // - After all mainConfig got merged into N.config
  //

  // load main app cnfig
  mainConfig = loadConfigs(mainRoot + '/config') || {};

  // read configs of sub-applications
  if (mainConfig.applications && mainConfig.applications.length) {
    _.forEach(mainConfig.applications, function (appName) {
      var root;

      root = path.dirname(require.resolve(appName)) + '/config';

      mergeConfigs(N.config, loadConfigs(root));
    });
  }

  // merge in main config and resolve `per-environment` configs
  mergeConfigs(N.config, mainConfig);

  // expand environment-dependent configs
  _.forEach(N.config, function (val, key) {
    if (key[0] === '^') {
      delete N.config[key];

      if (N.enviroment === key.substr(1)) {
        mergeConfigs(N.config, val);
      }
    }
  });

  //
  // Post-process config.
  //
  N.config.options = N.config.options || {};

  // Normalize cache directory path.
  N.config.options.cache_dir = path.resolve(mainRoot, N.config.options.cache_dir || './.cache');

  /*
  if (!N.config.themes) {
    N.config.themes = {};
  }

  if (!N.config.themes.schemas) {
    N.config.themes.schemas = {};
  }

  // check whenever theme is enabled or not
  function isEnabled(id) {
    // when whitelist speciefied:
    // enable only those specified in whitelist
    if (N.config.themes.enabled) {
      return 0 <= N.config.themes.enabled.indexOf(id);
    }

    // when blacklist is given and there's no whitelist
    // enable only those, not specified in the blacklist
    if (N.config.themes.disabled) {
      return -1 === N.config.themes.disabled.indexOf(id);
    }

    // else, when no white/black lists are given
    // enable by default
    return true;
  }

  _.forEach(N.config.themes.schemas, function (opts, id) {
    opts.enabled = isEnabled(id);
  });
  */
}


function initLogger(N) {
  var mainRoot  = N.mainApp.root,
      config    = _.assign({}, N.config.logger),
      options   = _.assign({ file: { logSize: 10, backups: 5 } }, config.options),
      // common logging level (minimal threshold)
      baseLevel = log4js.levels.toLevel(options.level, log4js.levels.ALL),
      // cache of initialized appenders
      appenders = {},
      // real loggers created for each entry in the config
      loggers   = [],
      // cache of met channels, maps full channel names to corresponding loggers
      channels  = {};

  //
  // define system (general) logger
  //

  N.logger = log4js.getLogger('system');

  //
  // provide a wrapper to set global log level
  //

  N.logger.setLevel = function (level) {
    level = log4js.levels[level.toUpperCase()];
    log4js.setGlobalLogLevel(level);
  };

  //
  // provide getLogger wrapper
  //

  N.logger.getLogger = function (name) {
    if (channels[name]) {
      return channels[name];
    }

    var chosenLogger, inputInfo = parseLoggerName(name);

    if (!inputInfo) {
      N.logger.error('Unacceptable logger channel name <%s>. Using <system>.', name);
      return N.logger;
    }

    chosenLogger = _.find(loggers, function (logger) {
      var loggerInfo = parseLoggerName(logger.category);

      // If the both have specified responder names - that must be equal.
      if (inputInfo.responderName && loggerInfo.responderName &&
          inputInfo.responderName !== loggerInfo.responderName) {
        return false;
      }

      // If the both have specified methods - that must match.
      if (inputInfo.splittedMethod && loggerInfo.splittedMethod) {
        return _.every(loggerInfo.splittedMethod, function (part, index) {
          return part === inputInfo.splittedMethod[index];
        });
      }
      return true;
    });

    if (!chosenLogger) {
      N.logger.warn('Logger <%s> not found. Using <system>.', name);
      chosenLogger = N.logger;
    }

    channels[name] = chosenLogger; // cache
    return chosenLogger;
  };

  //
  // Load supported appenders
  //

  log4js.loadAppender('file');
  log4js.loadAppender('console');
  log4js.loadAppender('logLevelFilter');

  //
  // Helper that returns thresholded appender
  // Resulting appender will log event with level => given `threshold` only
  //

  function thresholdedAppender(threshold, appender) {
    var level = baseLevel;

    if (threshold) {
      level = log4js.levels.toLevel(threshold, baseLevel);

      // get upper threshold
      level = level.isGreaterThanOrEqualTo(baseLevel) ? level : baseLevel;
    }

    // return thresholded appender
    return log4js.appenders.logLevelFilter(level, log4js.levels.FATAL, appender);
  }

  //
  // clear default loggers
  //

  log4js.clearAppenders();

  //
  // configure console logger for non-production environment only
  //

  if (N.enviroment !== 'production') {
    log4js.addAppender(log4js.appenders.console());
  }

  //
  // leave only loggers (with appenders) configs, removing keywords
  //

  delete config.options;

  //
  // configure logger categories and appenders
  //

  _.forEach(config, function (loggerConfig, name) {
    var resultLogger;

    _.forEach(loggerConfig, function (appenderConfig) {
      var filename, appender;

      if (!appenders[appenderConfig.file]) {
        filename = path.resolve(mainRoot, appenderConfig.file);

        // make sure destination directory for log file exists
        fstools.mkdirSync(path.dirname(filename));

        appenders[appenderConfig.file] = log4js.appenders.file(
          filename,                             // filename
          null,                                 // layout
          options.file.logSize * 1024 * 1024,   // logSize
          options.file.backups                  // numBackups
        );
      }

      // prepare thresholded appender
      appender  = thresholdedAppender(
        appenderConfig.level, appenders[appenderConfig.file]);

      log4js.addAppender(appender, name);
    });

    if (name !== 'system') {
      resultLogger           = log4js.getLogger(name);
      resultLogger.getLogger = N.logger.getLogger;

      // register logger in the internal cache
      loggers.push(resultLogger);
    }
  });

  //
  // Ensure loggers are placed in order from most specific to most general.
  // e.g. 'http@forum.index' comes earlier than 'http@forum'.
  //

  loggers.sort(function (a, b) {
    a = parseLoggerName(a.category);
    b = parseLoggerName(b.category);

    if (a.splittedMethod && b.splittedMethod) {
      // Both loggers have a specified splittedMethod.

      if (a.splittedMethod.length < b.splittedMethod.length) {
        return 1;

      } else if (a.splittedMethod.length > b.splittedMethod.length) {

        return -1;
      }

      // Both loggers have the same splittedMethod length.

      if (a.responderName && b.responderName) {
        // Both loggers have a specified responderName.
        return 0;
      }
      // Logger which has a responderName is more specific.
      return a.responderName ? -1 : 1;
    }

    // Logger which has a splittedMethod is more specific.
    return a.splittedMethod ? -1 : 1;
  });
}


// Just check, that you did not forgot to create config file
// Valid config MUST contain "configured: true" string
//
function checkConfig(N) {
  if (!N.config.configured) {
    throw new Error('No main configuration file (usually: config/application.yml)');
  }
}


// Run `init()` method for all registered apps.
// Usually, hooks loading is placed there
//
function initApps(N) {
  N.apps = [ N.mainApp ];

  // Try load each enabled application and push to the array of loaded apps
  _.forEach(N.config.applications, function (name) {
    N.apps.push(new Application(require(name)));
  });

  // Call init on each application
  _.forEach(N.apps, function (app) {
    app.init(N);
  });
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  initScope(N);
  initWire(N);
  initConfig(N);
  initLogger(N);

  N.logger.info('Loaded config files', N.__startupTimer.elapsed);
  var timer = stopwatch();

  checkConfig(N);
  initApps(N);

  //
  // Create `N.version_hash` - unique value, that tracks packages
  // and configs change. That helps to rebuild cache.
  //
  // - main dependencies are:
  //   - routes
  //   - enviroment
  //   - `package.json` for all apps
  //   - `bundle.yml` for all apps
  // - almost all is located in config. So, track all at once via config change.
  //
  var unique = JSON.stringify(_.omit(N.config, [ 'i18n', 'logger' ]));

  N.apps.forEach(function (app) {
    unique += fs.readFileSync(path.join(app.root, 'package.json'), 'utf-8');
  });

  N.version_hash = md5(unique);

  N.logger.info('Applications intialized', timer.elapsed);
};
