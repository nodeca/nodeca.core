// `views` section processor
//


'use strict';


// stdlib
var fs     = require('fs');
var path   = require('path');
var format = require('util').format;


// 3rd-party
var _       = require('lodash');
var fstools = require('fs-tools');


// internal
var stopwatch = require('../utils/stopwatch');
var ENGINES   = require('./views/engines');
var findPaths = require('./utils/find_paths');
var Processor = require('./utils/cached_processor');


////////////////////////////////////////////////////////////////////////////////


var wrapper_template_path = path.join(__dirname, 'views', 'wrapper.tpl');
var wrapper_template = _.template(fs.readFileSync(wrapper_template_path, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


var macroCache = {};
var macroRules = [ /'\$\$([^\r\n]+?)\$\$'/g, /"\$\$([^\r\n]+?)\$\$"/g ];

function processMacro(data, locals) {
  var body = '',
    key = Object.keys(locals).toString();

  // create evaluator wrapper
  if (!macroCache.hasOwnProperty(key)) {
    // build function, that allow macro to access `local` keys by name directly.
    Object.keys(locals).forEach(function (key) {
      body += 'var ' + key + ' = __locals.' + key + ';\n';
    });
    body += 'return eval(data);\n';
    /*eslint-disable no-new-func*/
    macroCache[key] = new Function('data', '__locals', body);
  }

  var result = data;

  macroRules.forEach(function (rule) {
    result = result.replace(rule, function (match, value, offset, orig) {
      try {
        return macroCache[key](value, locals);
      } catch (e) {
        // Fill error message
        var line = orig.slice(0, offset).split(/\r?\n/).length;
        throw new Error(format('Failed to evaluate macro `%s` [%s] at line %s',
          value.trim(), e.message, line));
      }
    });
  });

  return result;
}


module.exports = function (sandbox) {
  var N         = sandbox.N,
      clientDir = path.join(sandbox.tmpdir, 'views'),
      timer     = stopwatch();

  N.views = {};
  fstools.mkdirSync(clientDir);

  _.forEach(sandbox.config.packages, function (pkgConfig, pkgName) {
    var clientViews = {},
        clientFile  = path.join(clientDir, pkgName + '.js');

    // cacher for client templates
    var clientProcessor = new Processor({
      cache: path.join(N.config.options.cache_dir, 'modules_views', 'client-' + pkgName + '.json')
    });

    clientProcessor.process = function (file) {
      var extname = path.extname(file),
          render  = ENGINES[extname];
      return render.client(file);
    };

    // cacher for server templates
    var serverProcessor = new Processor({
      cache: path.join(N.config.options.cache_dir, 'modules_views', 'server-' + pkgName + '.json')
    });

    serverProcessor.process = function (file) {
      var extname = path.extname(file),
          render  = ENGINES[extname];
      return render.server(file);
    };

    var serverView, clientView;

    // Build templates
    findPaths(pkgConfig.views, function (file, apiPath) {
      try {
        // Process macro
        serverView = processMacro(serverProcessor.get(file), { N: N });
        clientView = processMacro(clientProcessor.get(file), { N: N });

        /*jshint evil:true*/
        /*eslint-disable no-new-func*/
        N.views[apiPath]     = (new Function('require', serverView))(require);
        clientViews[apiPath] = clientView;
      } catch (e) {
        throw new Error('Error in view "' + apiPath + '". ' + e);
      }
    });


    fs.writeFileSync(
      clientFile,
      Object.keys(clientViews).length ? wrapper_template({ views: clientViews }) : '',
      'utf8'
    );
  });

  N.logger.info('Processed views section %s', timer.elapsed);
};
