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
// - html  (String)     - rendered template
// - type  (String)     - format type
// - local (Boolean)    - is the link local or external (local ones will need permission checks later)
// - canonical (String) - original url if it got cut with url shortened service
//
'use strict';


const Embedza = require('embedza');
const Unshort = require('url-unshort');


module.exports = function (N, apiPath) {

  // Init url-unshort instance
  //
  function unshortCreate(cacheOnly) {
    let instance = new Unshort({
      cache: {
        get: N.models.core.UnshortCache.get.bind(N.models.core.UnshortCache),
        set: N.models.core.UnshortCache.set.bind(N.models.core.UnshortCache)
      }
    });

    // If we should read data only from cache - overwrite `request` method by stub
    if (cacheOnly) {
      instance.request = (options, callback) => {
        // return 503 status code because it's guaranteed not to be cached
        callback(null, { statusCode: 503, headers: {} }, '');
      };
    }

    return instance;
  }

  let unshort = { normal: unshortCreate(false), cached: unshortCreate(true) };


  // Init embedza instance
  //
  function embedzaCreate(cacheOnly) {
    let instance = new Embedza({
      cache: {
        get: N.models.core.EmbedzaCache.get.bind(N.models.core.EmbedzaCache),
        set: N.models.core.EmbedzaCache.set.bind(N.models.core.EmbedzaCache)
      },
      enabledProviders: N.config.embed.enabled
    });

    // If we should read data only from cache - overwrite `request` method by stub
    if (cacheOnly) {
      instance.request = function (__, callback) {
        callback(null, {});
      };
    }

    return instance;
  }

  let embedza = { normal: embedzaCreate(false), cached: embedzaCreate(true) };


  // Expand shortened links
  //
  N.wire.on(apiPath, function* expand_short_links(data) {
    let url;

    try {
      url = yield unshort[data.cacheOnly ? 'cached' : 'normal'].expand(data.url);
    } catch (__) {
      // ignore connection/parse errors
    }

    if (url) {
      data.canonical = url;
    }
  });


  // Process link as local
  //
  N.wire.on(apiPath, function* embed_local(data) {
    if (data.html) return;

    for (let i = 0; i < data.types.length; i++) {
      let type = data.types[i];
      let subcall_data = { url: data.canonical || data.url, type };

      yield N.wire.emit('internal:common.embed.local', subcall_data);

      if (subcall_data.html) {
        data.html  = subcall_data.html;
        data.type  = type;
        data.local = true;
        return;
      }
    }
  });


  // Process external link
  //
  N.wire.on(apiPath, function* embed_ext(data) {
    if (data.html) return;

    let result;

    try {
      result = yield embedza[data.cacheOnly ? 'cached' : 'normal'].render(
          data.canonical || data.url,
          data.types);
    } catch (__) {
      // If any errors happen, ignore them and leave the link as is
    }

    // If no result is returned, leave the link as is
    if (result) {
      data.html  = result.html;
      data.type  = result.type;
      data.local = false;
    }
  });
};
