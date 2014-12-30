// Add medialinker factory `N.medialinker`
//

'use strict';

var _           = require('lodash');
var Medialinker = require('medialinker');


var config = '$$ JSON.stringify(N.config.medialinks) $$';

N.wire.once('init:assets', function () {
  N.medialinker = _.memoize(function(configKey) {
    return new Medialinker(config.providers, config[configKey], true);
  });
});
