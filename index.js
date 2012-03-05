"use strict";


// stdlib
var Fs = require('fs');


// nodeca
var NLib = require('nlib');


// 3rd-party
var StaticLulz = require('static-lulz');
var FsTools = NLib.Vendor.FsTools;
var Async = NLib.Vendor.Async;
var _ = NLib.Vendor.Underscore;
var Redis = require('redis');
var Mongoose = require('mongoose');
var connect = require('connect');


module.exports = NLib.Application.create({
  root: __dirname,
  name: 'nodeca.core',
  bootstrap: function (nodeca, callback) {
    // empty bootstrap... for now..
    callback();
  }
});


var nodeca = global.nodeca;


// connect to redis
nodeca.hooks.init.before('initialization', function (next) {
  var cfg = (nodeca.config.database || {}).redis;

  if (!cfg) {
    next(new Error('No Redis configuration'));
    return;
  }

  nodeca.runtime.redis = Redis.createClient(cfg.port, cfg.host);

  nodeca.runtime.redis.once('error', next);
  nodeca.runtime.redis.once('connect', function () {
    nodeca.runtime.redis.removeListener('error', next);

    if (!cfg.index) {
      next();
      return;
    }

    nodeca.runtime.redis.send_command('SELECT', [cfg.index], function (err) {
      next(err);
    });
  });
});


// connect to mongoose
nodeca.hooks.init.before('initialization', function (next) {
  var cfg = (nodeca.config.database || {}).mongo, uri = 'mongodb://';

  if (!cfg) {
    next(new Error('No MongoDB configuration'));
    return;
  }

  // build mongodb connection uri
  if (cfg.user) {
    uri += cfg.user;

    if (cfg.pass) {
      uri += ':' + cfg.pass;
    }

    uri += '@';
  }

  uri += cfg.host;

  if (cfg.port) {
    uri += ':' + cfg.port;
  }

  uri += '/' + cfg.database;

  // connect to database
  nodeca.runtime.mongoose = Mongoose;
  Mongoose.connect(uri, next);
});


nodeca.hooks.init.after('bundles', function (next) {
  nodeca.runtime.assets_server = new StaticLulz();

  FsTools.walk(nodeca.runtime.assets_path, function (file, stats, next_file) {
    // Fill in Static lulz with files and data
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (buffer, callback) {
        var rel_path = file.replace(nodeca.runtime.assets_path, '');
        nodeca.runtime.assets_server.add(rel_path, buffer);
        callback();
      }
    ], next_file);
  }, next);
});


function execute_handler(api_path, func, env, params, callback) {
  // TODO: respect all api_path parents
  nodeca.filters.run(api_path, params, func, callback, env);
}


function find_view(scope, api_path) {
  var parts = api_path.split('.');

  while (scope && parts.length) {
    scope = scope[parts.shift()];
  }

  return scope;
}


nodeca.hooks.init.after('initialization', function (next) {
  var app = connect();

  app.use("/assets/", nodeca.runtime.assets_server.middleware);

  // middlewares
  app.use(connect.query());

  // main worker
  app.use(function (req, res) {
    var host = req.headers.host, env, match, method, params;

    // remove port part if it's 80
    if ('80' === host.split(':')[1]) {
      host = host.split(':')[0];
    }

    match = nodeca.runtime.router.match('//' + host + req.url.split('?').shift());

    if (!match) {
      // TODO: Fix not found handling
      res.statusCode = 500;
      res.end('Not found');
      return;
    }

    // resolve API name and function
    method = match.handler();

    if (!method.func) {
      // TODO: Fix method not found
      res.statusCode = 500;
      res.end('Method ' + method.name + ' not found');
      return;
    }

    // prefill environment
    env = {
      request: {
        origin: 'HTTP',
        method: method.name
      },
      response: {
        err: {
          code: null,
          message: null
        },
        data: null,
        // TODO: respect layout
        //layout: null,
        view: method.name
      }
    };

    params = _.extend(req.query || {}, match.params || {});
    execute_handler(method.name, method.func, env, params, function (err) {
      var view;

      if (err && err.redirect) {
        res.statusCode = err.redirect[0];
        res.setHeader('Location', err.redirect[1]);
        res.end();
        return;
      } else if (err) {
        // TODO: Fix error handling
        res.statusCode = 500;
        res.end(err.toString());
        return;
      }

      // TODO: respect session theme id
      // TODO: respect session lang id

      view = find_view(nodeca.runtime.views['core-desktop'], env.response.view);

      if (!view) {
        // TODO: Fix view not found handling
        res.statusCode = 500;
        res.end('View ' + env.response.view + ' not found');
        return;
      }

      // success render view
      res.end(view['en-US'](env.data));
    });
  });

  require('http').createServer(app).listen(3000);
  next();
});
