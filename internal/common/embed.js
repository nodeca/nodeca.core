// Fetch content of an url for embedding
//
// Data:
//
// - url   (String)   - link to content
// - types ([String]) - suitable format list, in priority order ('block', 'inline')
// - cacheOnly (Boolean) - use cache only
//
// Out:
//
// - html  (String)  - rendered template
// - type  (String)  - format type
// - local (Boolean) - is the link local or external (local ones will need permission checks later)
//
'use strict';


var Embedza = require('embedza');
var _       = require('lodash');


module.exports = function (N, apiPath) {

  // Init embedza instance
  //
  var embedzaCreate = _.memoize(function (cacheOnly) {
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


  // Pross link as local
  //
  N.wire.on(apiPath, function embed_local(data, callback) {
    if (data.html) {
      callback();
      return;
    }

    var types = data.types.slice(0);

    function next() {
      if (!types.length) {
        // delay callback until next tick to prevent stack overflow
        process.nextTick(callback);
        return;
      }

      var type = types.shift();
      var subcall_data = { url: data.url, type: type };

      N.wire.emit('internal:common.embed.local', subcall_data, function (err) {
        if (err) {
          callback(err);
          return;
        }

        if (!subcall_data.html) {
          next();
          return;
        }

        data.html  = subcall_data.html;
        data.type  = type;
        data.local = true;

        process.nextTick(callback);
      });
    }

    next();
  });


  // Process external link
  //
  N.wire.on(apiPath, function embed_ext(data, callback) {
    if (data.html) {
      callback();
      return;
    }

    embedzaCreate(data.cacheOnly).render(data.url, data.types, function (err, result) {
      // If any errors happen, ignore them and leave the link as is
      if (err) {
        callback();
        return;
      }

      // If no result is returned, leave the link as is
      if (result) {
        data.html  = result.html;
        data.type  = result.type;
        data.local = false;
      }

      callback();
    });
  });
};
