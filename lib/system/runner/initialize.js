// Read configs, init loggers, init apps, fills N object.


'use strict';


const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const _           = require('lodash');
const log4js      = require('log4js');
const validator   = require('is-my-json-valid');
const yaml        = require('js-yaml');
const wire        = require('event-wire');
const glob        = require('glob').sync;
const mkdirp      = require('mkdirp').sync;

const Application = require('./application');
const stopwatch   = require('../init/utils/stopwatch');


////////////////////////////////////////////////////////////////////////////////

// merge configs, respecting `~override: true` instructions
function mergeConfigs(dst, src) {
  _.forEach(src || {}, (value, key) => {

    // if destination exists & already has `~override` flag, keep it intact
    if (_.isObject(dst[key]) && dst[key]['~override']) {
      return;
    }

    // if source has `~override` flag - override whole value in destination
    if (value && value['~override']) {
      dst[key] = value;
      return;
    }

    // if both nodes are arrays, concatenate them
    if (_.isArray(value) && _.isArray(dst[key])) {
      value.forEach(v => { dst[key].push(v); });
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
  let config = {};

  glob('**/*.yml', {
    cwd: root
  })
  .sort() // files order can change, but we shuld return the same result always
  .map(file => path.join(root, file))
  .forEach(file => {
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
  let responderName, splittedMethod, parts = name.split('@');

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

  function findPuncher(params) {
    // Try find puncher in `params.extras.puncher`
    let puncher = (params.extras && params.extras.puncher) ? params.extras.puncher : null;

    // If puncher not found
    if (!puncher) {
      // Try find in `params.env.extras.puncher`
      puncher = (params.env && params.env.extras && params.env.extras.puncher) ? params.env.extras.puncher : null;
    }

    return puncher;
  }

  N.wire.hook('eachBefore', function (handler, params) {
    let puncher = findPuncher(params);

    if (puncher) {
      puncher.start(handler.name);
    }
  });

  N.wire.hook('eachAfter', function (handler, params) {
    let puncher = findPuncher(params);

    if (puncher) {
      puncher.stop();
    }
  });
}


function initScope(N) {

  // provide some empty structures
  N.client  = {};
  N.views   = {};

  // Storage for validators (each key is a `apiPath`)
  let validateFn = {};

  // Additional format extentions
  let validateFormatExt = {
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
}


function initConfig(N) {
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
  let mainConfig = loadConfigs(path.join(N.mainApp.root, '/config')) || {};

  // read configs of sub-applications
  if (mainConfig.applications && mainConfig.applications.length) {
    _.forEach(mainConfig.applications, appName => {
      let root = path.join(path.dirname(require.resolve(appName)), '/config');

      mergeConfigs(N.config, loadConfigs(root));
    });
  }

  // merge in main config and resolve `per-environment` configs
  mergeConfigs(N.config, mainConfig);

  // set application environment
  N.environment = process.env.NODECA_ENV || N.config.env_default || 'development';

  // do global expansion first
  // merge `^all` branch
  if (N.config['^all']) {
    mergeConfigs(N.config, N.config['^all']);
    delete N.config['^all'];
  }

  // expand environment-dependent configs
  _.forEach(N.config, (val, key) => {
    if (key[0] === '^') {
      delete N.config[key];

      if (N.environment === key.substr(1)) {
        mergeConfigs(N.config, val);
      }
    }
  });

  //
  // Post-process config.
  //
  N.config.options = N.config.options || {};
}


function initLogger(N) {
  let mainRoot  = N.mainApp.root,
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
  // provide shutdown wrapper
  //
  N.logger.shutdown = function (cb) {
    log4js.shutdown(cb);
  };


  //
  // provide getLogger wrapper
  //

  N.logger.getLogger = function (name) {
    if (channels[name]) {
      return channels[name];
    }

    let  inputInfo = parseLoggerName(name);

    if (!inputInfo) {
      N.logger.error('Unacceptable logger channel name <%s>. Using <system>.', name);
      return N.logger;
    }

    let chosenLogger = _.find(loggers, logger => {
      let loggerInfo = parseLoggerName(logger.category);

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
    let level = baseLevel;

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

  if (N.environment !== 'production') {
    log4js.addAppender(log4js.appenders.console());
  }

  //
  // leave only loggers (with appenders) configs, removing keywords
  //

  delete config.options;

  //
  // configure logger categories and appenders
  //

  _.forEach(config, (loggerConfig, name) => {
    _.forEach(loggerConfig, appenderConfig => {
      if (!appenders[appenderConfig.file]) {
        let filename = path.resolve(mainRoot, appenderConfig.file);

        // make sure destination directory for log file exists
        mkdirp(path.dirname(filename));

        appenders[appenderConfig.file] = log4js.appenders.file(
          filename,                             // filename
          null,                                 // layout
          options.file.logSize * 1024 * 1024,   // logSize
          options.file.backups                  // numBackups
        );
      }

      // prepare thresholded appender
      let appender  = thresholdedAppender(
        appenderConfig.level, appenders[appenderConfig.file]);

      log4js.addAppender(appender, name);
    });

    if (name !== 'system') {
      let resultLogger = log4js.getLogger(name);

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
  _.forEach(N.config.applications, name => { N.apps.push(new Application(require(name))); });

  // Call init on each application
  _.forEach(N.apps, app => app.init(N));
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {
  initScope(N);
  initWire(N);
  initConfig(N);
  initLogger(N);

  N.logger.info('Loaded config files', N.__startupTimer.elapsed);
  let timer = stopwatch();

  checkConfig(N);
  initApps(N);

  //
  // Create `N.version_hash` - unique value, that tracks packages
  // and configs change. That helps to rebuild cache.
  //
  // - main dependencies are:
  //   - routes
  //   - environment
  //   - `package.json` for all apps
  //   - `bundle.yml` for all apps
  // - almost all is located in config. So, track all at once via config change.
  //
  let hasher = crypto.createHash('md5');

  hasher.update(JSON.stringify(_.omit(N.config, [ 'logger' ])));

  N.apps.forEach(function (app, index) {
    hasher.update(fs.readFileSync(path.join(app.root, 'package.json'), 'utf-8'));
    try {
      hasher.update(fs.readFileSync(path.join(app.root, 'bundle.yml'), 'utf-8'));
    } catch (err) {
      // Rethrow for all apps except main one
      if (index > 0) { throw err; }
    }
  });

  N.version_hash = hasher.digest('hex');

  N.logger.info('Applications intialized', timer.elapsed);
};
