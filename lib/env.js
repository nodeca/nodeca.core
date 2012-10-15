'use strict';


/**
 *  lib
 **/


/*global nodeca*/


// 3rd-party
var Puncher = require('puncher');


////////////////////////////////////////////////////////////////////////////////


var tzOffset = (new Date).getTimezoneOffset();


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
 *  - **method**: Name of the server method, e.g. `'forums.posts.show'`
 *  - **layout**: Layout name as String
 **/
module.exports = function env(options) {
  var req = (options.http || options.rpc).req;
  var ctx = {
    extras:  {
      puncher: new Puncher()
    },
    helpers: {
      asset_path: function asset_path(path) {
        var asset = nodeca.runtime.assets.manifest.assets[path];
        return !asset ? "#" : nodeca.runtime.router.linkTo('assets', { path: asset });
      }
    },
    origin: {
      http: options.http,
      rpc: options.rpc
    },
    skip: (options.skip || []).slice(),
    session: options.session || null,
    request: {
      // FIXME: should be deprecated in flavour of env.origin
      origin:     !!options.rpc ? 'RPC' : 'HTTP',
      method:     options.method,
      ip:         req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      namespace:  String(options.method).split('.').shift()
    },
    data: {},
    runtime: {
      // FIXME: must be set from cookies
      theme: 'desktop'
    },
    response: {
      data: {
        head: {
          title: null, // should be filled with default value
          apiPath: options.method,
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
        widgets: {}
      },
      headers: {},
      // Layouts are supporting "nesting" via `dots:
      //
      //    default.blogs
      //
      // In the example above, `default.blogs` will be rendered first and the
      // result will be provided for rendering to `default`.
      layout: options.layout || 'default',
      // Default view template name == server method name
      // One might override this, to render different view
      //
      view: options.method
    }
  };

  //
  // env-dependent helper needs to be bounded to env
  //

  ctx.helpers.t = function (phrase, params) {
    var locale = this.runtime.locale || nodeca.config.locales['default'];
    return nodeca.runtime.i18n.t(locale, phrase, params);
  }.bind(ctx);

  ctx.helpers.t.exists = function (phrase) {
    var locale = this.runtime.locale || nodeca.config.locales['default'];
    return nodeca.runtime.i18n.hasTranslation(locale, phrase);
  }.bind(ctx);

  ctx.helpers.date = function (value, format) {
    var locale = this.runtime.locale || nodeca.config.locales['default'];
    return nodeca.shared.date(value, format, locale, tzOffset);
  }.bind(ctx);

  return ctx;
};
