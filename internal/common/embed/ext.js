// Fetch content by link for embedding
//
// Data:
//
// - link (String) - link to content
// - type ([String]) - suitable format list, in priority order ('block', 'inline')
// - cacheOnly (Boolean) - use cache only
//
// Out:
//
// - html (String) - rendered template
// - type (String) - format type
//
'use strict';


var Embedza = require('embedza');
var _       = require('lodash');


module.exports = function (N, apiPath) {

  // Init embedza instance
  //
  var embedzaInit = _.memoize(function (cacheOnly) {
    var instance = new Embedza({
      cache: N.models.core.EmbedzaCache,
      enabledProviders: N.config.parser.embed
    });

    // If we should read data only from cache - overwrite `request` method by stub
    if (cacheOnly) {
      instance.request = function (__, callback) {
        callback(null, {});
      };
    }

    return instance;
  });


  // Process link
  //
  N.wire.on(apiPath, function embed_ext(data, callback) {
    embedzaInit(data.cacheOnly).render(data.link, data.type, function (err, result) {
      // If any errors happen, ignore them and leave the link as is
      if (err) {
        callback();
        return;
      }

      // If no result is returned, leave the link as is
      if (result) {
        data.html = result.html;
        data.type = result.type;
      }

      callback();
    });
  });
};
