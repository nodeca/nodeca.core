// Fetch content of an url for embedding
//
// Data:
//
// - url       (String)   - link to content
// - types     ([String]) - suitable format list, in priority order ('block', 'inline')
// - cacheOnly (Boolean)  - use cache only
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
  const tracker_data_key = Symbol('tracker_data');

  // Init url-unshort instance
  //
  function unshortCreate(cacheOnly) {
    let instance = new Unshort({
      cache: {
        get: key => N.models.core.UnshortCache.get(key),
        set: (key, val) => N.models.core.UnshortCache.set(key, val)
      }
    });

    // If we should read data only from cache - overwrite `request` method by stub
    if (cacheOnly) {
      // return 503 status code because it's guaranteed not to be cached
      instance.request = () => Promise.reject({
        statusCode: 503
      });
    }

    return instance;
  }

  let unshort = { normal: unshortCreate(false), cached: unshortCreate(true) };


  // Init embedza instance
  //
  function embedzaCreate(cacheOnly) {
    let instance = new Embedza({
      cache: {
        get: key => N.models.core.EmbedzaCache.get(key),
        set: (key, val) => N.models.core.EmbedzaCache.set(key, val)
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
    let tracker_data = data[tracker_data_key] = data[tracker_data_key] || {};

    let url;

    try {
      url = yield unshort[data.cacheOnly ? 'cached' : 'normal'].expand(data.url);
      tracker_data.unshort_used = !!url;
    } catch (err) {
      // In case of connection/parse errors leave link as is
      tracker_data.unshort_error = err;
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

    let tracker_data = data[tracker_data_key] = data[tracker_data_key] || {};

    let result;

    try {
      result = yield embedza[data.cacheOnly ? 'cached' : 'normal'].render(
          data.canonical || data.url,
          data.types);

      tracker_data.embedza_used = !!result;
    } catch (err) {
      // If any errors happen, leave the link as is
      tracker_data.embedza_error = err;
    }

    // If no result is returned, leave the link as is
    if (result) {
      data.html  = result.html;
      data.type  = result.type;
      data.local = false;
    }
  });


  // Keep track of this url
  //
  N.wire.on(apiPath, function* track_url(data) {
    let tracker_data = data[tracker_data_key] || {};
    let update_data = { $set: {}, $unset: {} };

    let err = tracker_data.unshort_error || tracker_data.embedza_error;

    if (err) {
      let is_fatal = err.code === 'EHTTP' &&
                     [ 401, 403, 404 ].indexOf(err.statusCode) !== -1;

      update_data.$set.status         = N.models.core.UrlTracker.statuses[is_fatal ? 'ERROR_FATAL' : 'ERROR_RETRY'];
      update_data.$set.error          = err.message;
      update_data.$set.error_code     = err.statusCode || err.code;
      update_data.$unset.uses_unshort = true;
      update_data.$unset.uses_embedza = true;

    } else if (tracker_data.unshort_used || tracker_data.embedza_used) {
      update_data.$set.status       = N.models.core.UrlTracker.statuses.SUCCESS;
      update_data.$set.uses_unshort = !!tracker_data.unshort_used;
      update_data.$set.uses_embedza = !!tracker_data.embedza_used;
      update_data.$unset.error      = true;
      update_data.$unset.error_code = true;

    } else {
      // neither unshort nor embedza returned results,
      // so we don't need to update tracker that's already created by a parser
      return;
    }

    yield N.models.core.UrlTracker.update(
      { url: data.url },
      update_data,
      { upsert: false }
    );
  });
};
