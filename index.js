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
  var parts = api_path.split('.'), stack, more;

  //  We need to call before/after filters of all api_path parents.
  //  For this purpose we need to each parent filter run should nest child
  //  execution and the most bottom child is `func` itself (block).
  //  In other words we are doing something like `reduce` (or `inject`).
  //
  //  ##### Visual Explanation
  //
  //    api_path = "forum.posts.show"
  //
  //  Stack is filled from func, and up to the top most parent:
  //
  //    - stack: func
  //    - stack: filter('forum.posts.show') -> stack
  //    - stack: filter('forum.posts') -> stack
  //    - stack: filter('forum') -> stack
  //
  //  After filling the stack it's execution will be something like this:
  //
  //    - filter.before('forum')                  -> stack = filter('forum')
  //      - filter.before('forum.posts')          -> stack = filter('forum.posts')
  //        - filter.before('forum.posts.show')   -> stack = filter('forum.posts.show')
  //          - func                              -> stack = func
  //        - filter.after('forum.posts.show')
  //      - filter.after('forum.posts')
  //    - filter.after('forum')

  // initial memo
  stack = func;

  // helper wrap `nest` with parent filter execution
  more = function (hook_name) {
    // save current stack in current closure
    var curr = stack;

    // reassign stack with caller of `hook_name`,
    // using previous stack as `block` of hook chain
    stack = function () {
      // we care only about `next` callback here,
      // which is always the last one
      var next = arguments[arguments.length - 1];
      nodeca.filters.run(hook_name, params, curr, next, env);
    };
  };

  // fill the stack
  while (parts.length) {
    more(parts.join('.'));
    parts.pop();
  }

  // run stack
  stack(callback);
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
        layout: 'default',
        view: method.name
      }
    };

    params = _.extend(req.query || {}, match.params || {});
    execute_handler(method.name, method.func, env, params, function (err) {
      var data, view, layout, response;

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

      layout = nodeca.runtime.views['core-desktop'].layouts[env.response.layout];
      view = find_view(nodeca.runtime.views['core-desktop'], env.response.view);
      data = env.response.data || {};

      if (!view) {
        // TODO: Fix view not found handling
        res.statusCode = 500;
        res.end('View ' + env.response.view + ' not found');
        return;
      }

      // success render view
      response = view['en-US'](data);

      if (layout) {
        data.content = response;
        response = layout['en-US'](data);
      }

      res.end(response);
    });
  });

  require('http').createServer(app).listen(nodeca.config.listen.port);
  next();
});
