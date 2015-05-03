'use strict';


module.exports = function (N) {
  var wire      = require('event-wire');
  var Pointer   = require('pointer');
  var BabelFish = require('babelfish');

  N.runtime         = N.runtime || {};
  N.router  = new Pointer('$$ N.router.stringify() $$');

  // No need to set default locale in constructor, since we use 1
  // language on client.
  N.i18n    = new BabelFish('en-US');

  // translation helper with active locale
  N.runtime.t = function (phrase, params) {
    return N.i18n.t(N.runtime.locale, phrase, params);
  };

  N.runtime.t.exists = function (phrase) {
    return N.i18n.hasPhrase(N.runtime.locale, phrase);
  };

  N.wire           = wire();
  N.logger         = require('./kernel/logger');
  N.io             = require('./kernel/io')(N);
  N.runtime.render = require('./kernel/render')(N);

  // refer runtime in templates wrappers. Needed to render templates.
  N.__jade_runtime = require('jade/lib/runtime.js');

  N.enviroment     = '$$ JSON.stringify(N.enviroment) $$';
  N.version        = '$$ JSON.stringify(N.version) $$';

  //
  // Emit io.* events like rpc does to signal user about executing
  // network requests.
  //
  var defaultLoadAssets = N.loader.loadAssets;

  N.loader.loadAssets = function () {
    var args = Array.prototype.slice.call(arguments),
        callback = args[args.length - 1];

    N.wire.emit('io.request');

    args[args.length - 1] = function () {
      N.wire.emit('io.complete', {});
      return callback.apply(this, arguments);
    };

    return defaultLoadAssets.apply(this, args);
  };
};
