"use strict";


/*global nodeca, _*/


// stdlib
var path    = require('path');
var crypto  = require('crypto');


// nodeca
var HashTree = require('nlib').Support.HashTree;


// 3rd-party
var Mincer  = require('mincer');
var connect = require('connect');


////////////////////////////////////////////////////////////////////////////////


var http = module.exports = {};


////////////////////////////////////////////////////////////////////////////////


function static_server(root) {
  var static_urls = ['/favicon.ico', '/robots.txt', '/snippet.png'],
      options     = {root: root};

  return function (req, res, next) {
    if (-1 === static_urls.indexOf(req.url)) {
      next();
      return;
    }

    options.path    = req.url;
    options.getOnly = true;

    connect.static.send(req, res, next, options);
  };
}


////////////////////////////////////////////////////////////////////////////////


function app_server() {
  var static_helpers = {};

  static_helpers.asset_path = function asset_path(path) {
    var asset = nodeca.runtime.assets.environment.findAsset(path);
    return !asset ? "#" : ("/assets/" + asset.digestPath);
  };

  static_helpers.asset_include = function asset_include(path) {
    var asset = nodeca.runtime.assets.environment.findAsset(path);
    return !asset ? "" : asset.toString();
  };

  static_helpers.config = function (part) {
    return !part ? nodeca.config : HashTree.get(nodeca.config, part);
  };

  static_helpers.app_secret = function () {
    var rnd = crypto.randomBytes(16);
    return  'window.APP_SECRET = "' +
            crypto.createHash('md5').update(rnd).digest('hex') +
            '";';
  };

  static_helpers.link_to = function (name, params) {
    return nodeca.runtime.router.linkTo(name, params) || '#';
  };

  return function (req, res) {
    var host = req.headers.host, env, match, params;

    if (-1 === nodeca.runtime.router.__vhosts__.known.indexOf(host)) {
      host = nodeca.runtime.router.__vhosts__.default_host;
    }

    if (host) {
      host = '//' + host;
    }

    match = nodeca.runtime.router.match(host + req.url.split('?').shift());

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
        data: {},
        headers: {},
        layout: 'default',
        view: match.meta.name
      }
    };

    // mix GET QUERY params (part after ? in URL) and params from router
    // params from router tke precedence
    params = _.extend(req.query || {}, match.params || {});
    nodeca.filters.run(match.meta.name, params, match.meta.func, function (err) {
      var data, view, layout, response;

      // set required headers
      _.each(env.response.headers || {}, function (value, name) {
        res.setHeader(name, value);
      });

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
        nodeca.logger.error(err.stack || err.toString());

        res.statusCode = 500;
        res.end(('development' !== nodeca.runtime.env) ? 'Application error'
                : (err.stack || err.toString()));
        return;
      }

      layout  = nodeca.runtime.views[env.session.theme].layouts[env.response.layout];
      view    = HashTree.get(nodeca.runtime.views[env.session.theme], env.response.view);
      data    = _.extend({}, env.response.data, static_helpers, {
        t: function (phrase, params) {
          return nodeca.runtime.i18n.t(env.session.lang, phrase, params);
        }
      });

      if (!view) {
        res.statusCode = 500;
        res.end('View ' + env.response.view + ' not found.');
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
  };
}


////////////////////////////////////////////////////////////////////////////////


http.attach = function attach(server, next) {
  var app     = connect(),
      assets  = nodeca.runtime.assets;

  app.use("/assets/",   Mincer.createServer(assets.environment, assets.manifest));
  app.use("/",          static_server(path.join(nodeca.runtime.apps[0].root, 'public/root')));
  app.use("/",          connect.query());
  app.use("/",          app_server());

  // connect application is an ordinary
  // HTTP(S) request event handler
  server.on('request', app);
  next();
};
