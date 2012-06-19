'use strict';


/*global nodeca, _*/


module.exports = function env(options) {
  return {
    t: function (phrase, params) {
      return nodeca.runtime.i18n.t(this.session.locale, phrase, params);
    },
    origin: {
      http:     options.http,
      realtime: options.realtime
    },
    skip: (options.skip || []).slice(),
    // FIXME: should be filled by session middleware
    session: options.session || {
      theme:  'desktop',
      locale: nodeca.config.locales['default']
    },
    request: {
      // FIXME: should be deprecated in flavour of env.origin
      origin:     !!options.realtime ? 'RT' : 'HTTP',
      method:     options.method,
      namespace:  options.method.split('.').shift()
    },
    response: {
      data: {
        widgets: {}
      },
      headers: {},
      layout: options.layout || 'default',
      view:   options.method
    }
  };
};
