// Fetch content of an url for embedding
//
// Data:
//
// - url       (String)   - link to content
// - types     ([String]) - suitable format list, in priority order ('block', 'inline')
// - bulk      (Boolean)  - we use separate relimit for bulk requests to avoid
//                          them delaying requests triggered by user
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


const _           = require('lodash');
const Embedza     = require('embedza');
const Unshort     = require('url-unshort');
const embedza_pkg = require('embedza/package.json');
const unshort_pkg = require('url-unshort/package.json');
const memoize     = require('promise-memoize');
const Relimit     = require('relimit');
const url         = require('url');
const limits      = require('nodeca.core/lib/app/relimit_limits');

// total connection count should be around 100 to avoid timeouts,
// divided between two relimiters (normal and bulk)
const MAX_CONNECTIONS = 50;

function timeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      setTimeout(() => {
        let err = new Error('Promise timed out');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, ms);
    })
  ]);
}


module.exports = function (N, apiPath) {
  const tracker_data_key = Symbol('tracker_data');

  let rootUrl = (N.config.bind?.default?.mount || 'http://localhost') + '/';
  let userAgentEmbedza = `${embedza_pkg.name}/${embedza_pkg.version} (Nodeca; +${rootUrl})`;
  let userAgentUnshort = `${unshort_pkg.name}/${unshort_pkg.version} (Nodeca; +${rootUrl})`;

  function normalize(item) {
    return (url.parse(item.url).hostname || '');
  }

  function create_relimit() {
    let relimit = new Relimit({
      scheduler: N.config.database?.redis,
      rate(item) {
        return limits.rate(normalize(item));
      },
      consume(item) {
        if (this.stat().active >= MAX_CONNECTIONS) return false;

        let domain = normalize(item);

        if (this.stat(domain).active >= limits.max_connections(domain)) {
          return false;
        }

        return true;
      },
      normalize,
      async process(item) {
        await item.fn();
      }
    });

    return function wrap(request_fn) {
      return function (...args) {
        return new Promise((resolve, reject) => {
          relimit.push({
            url: args[0],
            fn: () => {
              return request_fn.apply(this, args).then(resolve, reject);
            }
          });
        });
      };
    };
  }

  let relimit = { normal: create_relimit(), bulk: create_relimit() };

  // Init url-unshort instance
  //
  function create_unshort_template() {
    return new Unshort({
      cache: {
        get: key => N.models.core.UnshortCache.get(key),
        set: (key, val) => N.models.core.UnshortCache.set(key, val)
      },
      request: {
        headers: {
          'user-agent': userAgentUnshort
        }
      }
    });
  }


  // Init embedza instance
  //
  function create_embedza_template() {
    return new Embedza({
      cache: {
        get: key => N.models.core.EmbedzaCache.get(key),
        set: (key, val) => N.models.core.EmbedzaCache.set(key, val)
      },
      enabledProviders: N.config.embed.enabled,
      request: {
        headers: {
          'user-agent': userAgentEmbedza
        }
      }
    });
  }


  // Initialize unshort instances (normal, normal_bulk, cached)
  //
  let unshort = {};

  unshort.normal = create_unshort_template();
  unshort.normal.request = relimit.normal(unshort.normal.request);

  unshort.normal_bulk = create_unshort_template();
  unshort.normal_bulk.request = relimit.bulk(unshort.normal_bulk.request);

  unshort.cached = create_unshort_template();
  unshort.cached.request = () => Promise.reject({ statusCode: 503 });


  // Initialize embedza instances (normal, normal_bulk, cached)
  //
  let embedza = {};

  embedza.normal = create_embedza_template();
  embedza.normal.request = relimit.normal(embedza.normal.request);

  embedza.normal_bulk = create_embedza_template();
  embedza.normal_bulk.request = relimit.bulk(embedza.normal_bulk.request);

  embedza.cached = create_embedza_template();
  embedza.cached.request = () => Promise.reject({ statusCode: 503 });


  // Allow to extend unshort or embedza with custom rules
  //
  N.wire.emit('init:embed', { unshort, embedza });


  // Expand shortened links
  //
  N.wire.before(apiPath, async function expand_short_links(data) {
    let tracker_data = data[tracker_data_key] = data[tracker_data_key] || {};

    let url;

    try {
      let unshort_type = data.cacheOnly ? 'cached'      :
                         data.bulk      ? 'normal_bulk' :
                                          'normal';

      url = await timeout(unshort[unshort_type].expand(data.url), 130000);
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
  N.wire.on(apiPath, async function embed_local(data) {
    if (data.html) return;

    for (let i = 0; i < data.types.length; i++) {
      let type = data.types[i];
      let subcall_data = { url: data.canonical || data.url, type };

      await N.wire.emit('internal:common.embed.local', subcall_data);

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
  N.wire.on(apiPath, async function embed_ext(data) {
    if (data.html) return;

    let tracker_data = data[tracker_data_key] = data[tracker_data_key] || {};

    let result;

    try {
      let embedza_type = data.cacheOnly ? 'cached'      :
                         data.bulk      ? 'normal_bulk' :
                                          'normal';

      result = await timeout(embedza[embedza_type].render(
          data.canonical || data.url,
          data.types), 130000);

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


  // Replace banned links with placeholder
  //
  const get_banned_links_re = memoize(function () {

    return N.settings.getStore('global')
                .get('content_filter_urls')
                .then(patterns => {
                  if (patterns.value.trim().length) {
                    return new RegExp(
                      patterns.value.split(/\s+/)
                                    .map(_.escapeRegExp)
                                    .join('|'),
                      'i');
                  }
                  return null;
                });

  }, { maxAge: 60000 });


  N.wire.after(apiPath, async function filter_links(data) {
    let url = data.canonical || data.url;

    let banned_links = await get_banned_links_re();

    if (banned_links && banned_links.test(url)) {
      data.html = '<span class="link-banned">banned link</span>';
    }
  });


  // Keep track of this url
  //
  N.wire.after(apiPath, { priority: 100 }, async function track_url(data) {
    // don't track anything during rebuild (all errors will be 503 regardless)
    if (data.cacheOnly) return;

    let tracker_data = data[tracker_data_key] || {};
    let update_data = { $set: {}, $unset: {}, $inc: { retries: 1 } };

    let err = tracker_data.unshort_error || tracker_data.embedza_error;

    update_data.$set.uses_unshort = Boolean(tracker_data.unshort_used || tracker_data.unshort_error);
    update_data.$set.uses_embedza = Boolean(tracker_data.embedza_used || tracker_data.embedza_error);

    if (err) {
      // retry all errors except:
      //  - 5xx - server-side errors
      //  - 429 - rate limit
      //  - 408 - request timeout
      //  - EINVAL - bad urls like http://1234
      let is_fatal = err.statusCode && !String(+err.statusCode).match(/^(5..|429|408)$/) ||
                     err.code === 'EINVAL';

      update_data.$set.status         = N.models.core.UrlTracker.statuses[is_fatal ? 'ERROR_FATAL' : 'ERROR_RETRY'];
      update_data.$set.error          = err.message;
      update_data.$set.error_code     = err.statusCode || err.code;

    } else if (tracker_data.unshort_used || tracker_data.embedza_used) {
      update_data.$set.status       = N.models.core.UrlTracker.statuses.SUCCESS;
      update_data.$unset.error      = true;
      update_data.$unset.error_code = true;

    } else {
      // neither unshort nor embedza returned results,
      // so we don't need to update tracker that's already created by a parser
      return;
    }

    // delete empty $unset - causes request error
    for (let k of Object.keys(update_data)) {
      if (Object.keys(update_data[k]).length === 0) delete update_data[k];
    }

    await N.models.core.UrlTracker.updateOne(
      { url: data.url },
      update_data,
      { upsert: false }
    );
  });
};
