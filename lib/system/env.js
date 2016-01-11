// Prepares request environment (`this` context of server methods/filters).


'use strict';


var _       = require('lodash');
var Puncher = require('puncher');


////////////////////////////////////////////////////////////////////////////////


var DEFAULT_HTTP_PORT  = 80;
var DEFAULT_HTTPS_PORT = 443;


// Finds the most appropriate server binding in config, by ApiPath.
// Probably, can be cached (if use _.memoize, swap params first)
//
function findServerSocketConfig(N, apiPath) {
  var splitted = apiPath.split('.'), bind;

  // Reduce apiPath looking for matching binds.
  while (!_.isEmpty(splitted)) {
    bind = N.config.bind[splitted.join('.')];

    if (bind) {
      return bind; // Found.
    }

    splitted.pop();
  }

  return N.config.bind['default'] || null;
}

// Resolve full phrase path
//
function resolveI18nPath(path, _self) {
  if (path.charAt(0) === '@') {
    // absolute
    return path.slice(1);
  }
  // relative
  return _self.method + '.' + path;
}


////////////////////////////////////////////////////////////////////////////////
// Env helpers

var DEFAULT_INIT_HANDLERS = [];
var DEFAULT_CLONE_HANDLERS = [];

var DEFAULT_HELPERS = {
  // Server and render helper closures.
  //
  set_layout: function set_layout_helper(layout) {
    this.res.layout = layout;
  },

  link_to: function link_to_helper(name, params) {
    return this.__N.router.linkTo(name, params) || '#';
  },

  // Constructs full URL using current env and N.config.bind
  //
  url_to: function url_to_helper(apiPath, params, linkDefaults) {
    // Reconstruct linkDefaults to prevent side-effects.
    linkDefaults = _.pick(linkDefaults || {}, 'protocol', 'hostname', 'port');

    // Detect protocol.
    if (!linkDefaults.protocol) {
      linkDefaults.protocol = this.req.isEncrypted ? 'https' : 'http';
    }

    // Detect hostname.
    if (!linkDefaults.hostname && this.origin.req.headers.host) {
      linkDefaults.hostname = this.origin.req.headers.host.split(':')[0];
    }

    var bind = findServerSocketConfig(this.__N, apiPath);

    // Detect port.
    if (bind && !linkDefaults.port) {
      if (linkDefaults.protocol === 'https') {
        // For encrypted HTTPS connection.
        linkDefaults.port = bind.ssl.listen.port;

        if (bind.ssl.forwarded || DEFAULT_HTTPS_PORT === bind.ssl.listen.port) {
          linkDefaults.port = null; // Do not set default port explicitly.
        }
      } else {
        // For plain HTTP connection.
        linkDefaults.port = bind.listen.port;

        if (bind.forwarded || DEFAULT_HTTP_PORT === bind.listen.port) {
          linkDefaults.port = null; // Do not set default port explicitly.
        }
      }
    }

    return this.__N.router.linkTo(apiPath, params, linkDefaults);
  },

  asset_url: function asset_url_helper(path) {
    return this.__N.assets.asset_url(path);
  },

  asset_include: function asset_include_helper(path) {
    return this.__N.assets.asset_body(path);
  },

  // ---------------------------------------------------------------------------
  // It's common to override this helpers. For example to take locale from
  // `env.current_user`, to don't touch `env.runtime`. That can be convenient if
  // you need to quickly subcall another server method with cloned env directly
  // (without wrappers).
  t: function translate_helper(/*phrase, params*/) {
    throw new Error('`env.helpers.t` hook should be overridden');
  },

  t_exists: function translate_exists_helper(/*phrase*/) {
    throw new Error('`env.helpers.t_exists` hook should be overridden');
  },
  // ---------------------------------------------------------------------------

  add_raw_data: function add_raw_data_helper(key, data) {
    if (this.runtime.page_data.hasOwnProperty(key)) {
      this.__N.logger.warn('Override of %j key in env.runtime.page_data');
    }

    this.runtime.page_data[key] = data;
  }
};


////////////////////////////////////////////////////////////////////////////////

/**
 *  lib.env(options) -> Object
 *  - options (Object): Environment options.
 *
 *  Create new request environment object.
 *
 *
 *  ##### Options
 *
 *  - **type**: Request type
 *  - **isEncrypted**: Is https (Boolean)
 *  - **params**: Request params
 *  - **session**: Session object
 *  - **matched**: Router metadata
 *  - **remoteAddress**: original IP (in direct & forwarded mode)
 **/
function Env(N, options) {
  var self = this;

  // Private, for helpers
  this.__N = N;

  this.params   = options.params || {};
  this.method   = null;

  // Contains server chain response on success
  this.data     = {};

  // internal, to pass error from server chain to responders
  this.err      = null;
  // internal, rendered data
  this.body     = null;
  // internal, http status code (set in responders)
  this.status   = N.io.OK;
  // filled by formidable with `fields & `files` structures, for http POST requests
  this.post     = null;

  this.headers  = {};


  this.runtime  = {
    page_data: {}
  };

  var puncher = new Puncher();
  puncher.start('Total');

  this.extras   = {
    puncher: puncher
  };

  this.origin   = {
    req: options.req,
    res: options.res
  };

  this.session  = options.session || null;

  this.req      = {
    type:        options.type,
    isEncrypted: options.isEncrypted,
    ip:          options.remoteAddress,
    matched:     options.matched || null,
    tzOffset:    new Date().getTimezoneOffset() // use server tz by default
  };

  this.res      = {
    head: {
      title: null, // should be filled with default value

      // List of assets for loader,
      // Each element is an object with properties:
      //
      //    type:   css|js
      //    link:   asset_url
      //
      // example: assets.push({type: 'js', link: '//example.com/foo.js'});
      assets: []
    },
    menus: {}
  };

  this.log_request = function log_request_dummy() {};

  // Pin helpers (those are shared with server methods and renderer)
  //
  this.helpers  = {};

  Object.keys(DEFAULT_HELPERS).forEach(function (h) {
    self.helpers[h] = DEFAULT_HELPERS[h].bind(self);
  });

  // TODO: remove this alias
  this.helpers.t.exists = function (phrase) {
    return self.helpers.t_exists(phrase);
  };

  // Server-only helper closures.
  //
  this.t        = function translate_helper(phrase, params) {
    return self.helpers.t(resolveI18nPath(phrase, self), params);
  };

  this.t.exists = function translate_exists_helper(phrase) {
    return self.helpers.t_exists(resolveI18nPath(phrase, self));
  };

  // Run initializers for complex things (nested properties).
  // For example - settings, cookies
  //
  DEFAULT_INIT_HANDLERS.forEach(function (handler) {
    handler(self);
  });
}


// TODO: not needed anymore, but probably can be useful in client requests combiner.
// cleanup later.
Env.prototype.clone = function () {
  var self     = this;
  var env      = new Env(this.__N, {});

  env.origin   = this.origin;
  env.session  = this.session;
  env.req      = this.req;

  // Run custom functions to clone additional
  // env properties (e.g. env.user_info).
  //
  DEFAULT_CLONE_HANDLERS.forEach(function (handler) {
    handler(env, self);
  });

  return env;
};


////////////////////////////////////////////////////////////////////////////////

module.exports = function createEnv(N, options) {
  return new Env(N, options);
};

// for modifications
module.exports.helpers       = DEFAULT_HELPERS;        // mixed to env & renderer
module.exports.initHandlers  = DEFAULT_INIT_HANDLERS;  // executed on `new`
module.exports.cloneHandlers = DEFAULT_CLONE_HANDLERS; // executed on `clone`
