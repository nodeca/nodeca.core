// Prepares request environment (`this` context of server methods/filters).


'use strict';


var _       = require('lodash');
var Puncher = require('puncher');
var date    = require('./date');


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
function resolveI18nPath(path, self) {
  if ('@' === path.charAt(0)) {
    // absolute
    return path.slice(1);
  }
  // relative
  return self.method + '.' + path;
}


////////////////////////////////////////////////////////////////////////////////
// Env helpers

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
      if ('https' === linkDefaults.protocol) {
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

  asset_path: function asset_path_helper(path) {
    var asset = this.__N.assets.manifest.assets[path];

    return asset ? this.__N.router.linkTo('core.assets', { path: asset }) : '#';
  },

  asset_include: function asset_include_helper(path) {
    var asset  = this.__N.assets.environment.findAsset(path),
        result = '';

    if (asset) {
      try {
        result = asset.toString();
      } catch (err) {
        this.__N.logger.error(
          'Failed inline asset %s:\n%s',
          path,
          err.stack || err.message || err
        );
      }
    }

    return result;
  },

  t: function translate_helper(phrase, params) {
    var locale = this.runtime.locale || this.__N.config.locales['default'];

    return this.__N.i18n.t(locale, phrase, params);
  },

  t_exists: function translate_exists_helper(phrase) {
    var locale = this.runtime.locale || this.__N.config.locales['default'];

    return this.__N.i18n.hasPhrase(locale, phrase);
  },

  date: function date_helper(value, format) {
    var locale = this.runtime.locale || this.__N.config.locales['default'];

    return date(value, format, locale, 0);
  },

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
 *  - **http**: HTTP origin object that contains `req` and `res`.
 *  - **rpc**: API3 (Ajax) origin that contains `req` and `res`.
 *  - **skip**: Array of middlewares to skip
 *  - **session**: Session object
 *  - **locale**: Locale name as String
 *  - **method**: Name of the server method, e.g. `'forums.posts.show'`
 *  - **layout**: Layout name as String
 **/
function Env(N, options) {
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

  this.extras   = {
    puncher: new Puncher(),
    settings: {
      params: {},
      fetch: function fetchSettings(keys, callback) {
        N.settings.get(keys, this.params, {}, callback);
      }
    }
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
    matched:     options.matched || null
  };

  this.res      = {
    head: {
      title: null, // should be filled with default value

      // List of assets for yepnope,
      // Each element is an object with properties:
      //
      //    type:   css|js
      //    link:   asset_url
      //
      // example: assets.push({type: 'js', link: '//example.com/foo.js'});
      assets: []
    },
    menus: {},
    blocks: {}
  };

  this.log_request = function log_request_dummy() {};

  //
  // Pin helpers
  //

  this.helpers  = {};

  Object.keys(DEFAULT_HELPERS).forEach(function (h) {
    this.helpers[h] = DEFAULT_HELPERS[h].bind(this);
  }, this);

  this.helpers.t.exists = this.helpers.t_exists; // alias

  // Server-only helper closures.
  //
  this.t        = function translate_helper(phrase, params) {
    return this.helpers.t(resolveI18nPath(phrase, this), params);
  };

  this.t.exists = function translate_exists_helper(phrase) {
    return this.helpers.t_exists(resolveI18nPath(phrase, this));
  };
}


////////////////////////////////////////////////////////////////////////////////

module.exports = function createEnv(N, options) {
  return new Env(N, options);
};

module.exports.helpers = DEFAULT_HELPERS; // for modifications
