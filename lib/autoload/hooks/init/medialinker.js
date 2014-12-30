// Add medialinker factory `N.medialinker`
//

'use strict';

var _           = require('lodash');
var Medialinker = require('../../../parser/medialinker');

module.exports = function (N) {

  N.wire.after('init:bundle', function medialinker_init() {
    N.medialinker = _.memoize(function(configKey) {
      return new Medialinker(N.config.medialinks.providers, N.config.medialinks[configKey], false);
    });
  });
};
