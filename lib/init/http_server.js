"use strict";


/*global nodeca, _*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var connect = require('connect');


// HELPERS /////////////////////////////////////////////////////////////////////


function find_view(scope, api_path) {
  var parts = api_path.split('.');

  while (scope && parts.length) {
    scope = scope[parts.shift()];
  }

  return scope;
}


function start_server(app, next) {
  var server, host, port, err_handler, attempt = 0;

  // create server
  host    = nodeca.config.listen.host || 'localhost';
  port    = nodeca.config.listen.port || 3000;
  server  = require('http').createServer(app);

  err_handler = function (err) {
    if (err.code === 'EADDRINUSE') {
      if (3 <= attempt) {
        next("Maximum amount of attempts reached. Can't continue.");
        return;
      }

      attempt += 1;
      nodeca.logger.warn('Address <' + host + ':' + port + '> in use, retrying... ');
      setTimeout(function () { server.listen(port, host); }, 1000);
    }
  };

  server.on('error', err_handler);

  // start server
  server.listen(port, host, function () {
    server.removeListener('error', err_handler);
    next();
  });
}


// MODULE EXPORTS //////////////////////////////////////////////////////////////


module.exports = function (next) {
  var app = connect(), default_host = nodeca.config.listen.host, static_helpers;

  if (!!nodeca.config.listen.port && 80 !== +nodeca.config.listen.port) {
    default_host += ":" + nodeca.config.listen.port;
  }

  app.use("/assets/", nodeca.runtime.assets_server.middleware);

  // middlewares
  app.use(connect.query());

  // define some request/session insensitive view helpers
  static_helpers = {
    link_to: function (name, params) {
      return nodeca.runtime.router.linkTo(name, params) || '#';
    }
  };

  // main worker
  app.use(function (req, res) {
    var host = req.headers.host || default_host, env, match, params;

    // remove port part if it's 80
    if ('80' === host.split(':')[1]) {
      host = host.split(':')[0];
    }

    match = nodeca.runtime.router.match('//' + host + req.url.split('?').shift());

    if (!match) {
      // TODO: Fix not found handling
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    // prefill environment
    env = {
      request: {
        origin: 'HTTP',
        method: match.meta.name,
        namespace: match.meta.name.split('.').shift()
      },
      session: {
        // FIXME: use req.session instead
        theme: 'desktop',
        lang: nodeca.config.locales.default
      },
      response: {
        err: {
          code: null,
          message: null
        },
        data: {},
        layout: 'default',
        view: match.meta.name
      }
    };

    // mix GET QUERY params (part after ? in URL) and params from router
    // params from router tke precedence
    params = _.extend(req.query || {}, match.params || {});
    nodeca.filters.run(match.meta.name, params, match.meta.func, function (err) {
      var data, view, layout, response;

      if (err && err.redirect) {
        res.statusCode = err.redirect[0];
        res.setHeader('Location', err.redirect[1]);
        res.end();
        return;
      } else if (err && err.denied) {
        res.statusCode = 403;
        res.end(err.message || 'Forbidden');
        return;
      } else if (err) {
        res.statusCode = 500;
        res.end(('development' !== nodeca.runtime.env) ? 'Application error'
                : (err.stack || err.toString()));
        return;
      }

      layout = nodeca.runtime.views[env.session.theme].layouts[env.response.layout];
      view = find_view(nodeca.runtime.views[env.session.theme], env.response.view);
      data = _.extend({}, env.response.data, static_helpers, {
        t: function (phrase, params) {
          return nodeca.runtime.i18n.t(env.session.lang, phrase, params);
        }
      });

      if (!view) {
        res.statusCode = 500;
        res.end('View ' + env.response.view + ' not found');
        return;
      }

      // success render view
      response = view[env.session.lang](data);

      if (layout) {
        data.content = response;
        response = layout[env.session.lang](data);
      }

      res.end(response);
    }, env); // nodeca.filters.run
  });

  start_server(app, next);
};
