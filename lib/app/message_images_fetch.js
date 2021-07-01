// Create worker to fetch images from remote servers and cache their size
//
// params:
//
// - task_name (String)
// - find (Function => Promise) - `function (id)`
// - rebuild (Function => Promise) - `function (id)`
//
'use strict';


const _            = require('lodash');
const $            = require('nodeca.core/lib/parser/cheequery');
const probe        = require('probe-image-size');
const probe_pkg    = require('probe-image-size/package.json');
const Relimit      = require('relimit');
const url          = require('url');
const limits       = require('nodeca.core/lib/app/relimit_limits');

const MAX_CONNECTIONS = 100;

let relimit;


module.exports = function (N, params) {

  let rootUrl = (N.config.bind?.default?.mount || 'http://localhost') + '/';
  let userAgent = `${probe_pkg.name}/${probe_pkg.version} (Nodeca; +${rootUrl})`;

  function normalize(item) {
    return (url.parse(item.url).hostname || '');
  }

  relimit = relimit || new Relimit({
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
      await item.callback();
    }
  });


  N.queue.registerTask({
    name: params.task_name,

    // 5 minute delay by default
    postponeDelay: 5 * 60 * 1000,
    retryDelay: 5 * 60 * 1000,

    timeout: 180000,

    retries: 3,

    taskID(msg_id) {
      return `${params.task_name}:${msg_id}`;
    },

    async process(msg_id) {
      const extendDeadline = _.throttle(() => this.setDeadline(180000), 10000);
      const statuses       = N.models.core.ImageSizeCache.statuses;

      let post   = await params.find(msg_id);

      // quick check if there are any images before parsing
      if (!/<img/i.test(post.html)) return;

      let $html  = $.parse(post.html);
      let images = [];

      // get the list of images in this post
      $html.find('.image').each(function () {
        let url = $(this).attr('src');

        if (url) images.push(url);
      });

      if (!images.length) return;

      let needs_rebuild = false;
      let needs_restart = false;

      let url_sizes = await N.models.core.ImageSizeCache
                               .where('url').in(images)
                               .where('status').in([ statuses.PENDING, statuses.ERROR_RETRY ])
                               .lean(true);

      if (!url_sizes) return;

      let remaining_tasks = url_sizes.length;
      let task_finish;
      let task_error;
      let relimit_wait = new Promise((resolve, reject) => {
        task_finish = resolve;
        task_error = reject;
      });

      relimit.on('error', task_error);

      if (remaining_tasks <= 0) task_finish();

      relimit.push(url_sizes.map(u => ({
        url: u.url,
        // relimit is shared between tasks, so we need to add callback
        // to pin result to this task
        async callback() {
          extendDeadline();

          let url = u.url;
          let result;
          let err;

          let cache = {
            url: u.url,
            retries: (u.retries || 0) + 1
          };

          try {
            result = await probe(url, {
              headers: { 'User-Agent': userAgent },
              open_timeout: 15000,
              response_timeout: 120000,
              read_timeout: 120000
            });
          } catch (_err) {
            err = _err;
          }

          if (err) {
            // retry all errors except:
            //  - 5xx - server-side errors
            //  - 429 - rate limit
            //  - 408 - request timeout
            //  - EINVAL - bad urls like http://1234
            //  - ECONTENT - probe error: not a picture
            let is_fatal = (err.statusCode && !String(+err.statusCode).match(/^(5..|429|408)$/)) ||
                           err.code === 'EINVAL' ||
                           err.code === 'ECONTENT';

            cache.status     = is_fatal ? statuses.ERROR_FATAL : statuses.ERROR_RETRY;
            cache.error      = err.message;
            cache.error_code = err.statusCode || err.code;

            // if it's a temporary failure, restart this task later
            if (!is_fatal) {
              needs_restart = true;
            }
          } else {
            cache.status = statuses.SUCCESS;
            cache.value = result;

            // if we got at least one image, rebuild the post
            needs_rebuild = true;
          }

          // Replace old object with the new one to reset any previously
          // fetched results (i.e. error status codes).
          //
          await N.models.core.ImageSizeCache.replaceOne(
            { url },
            cache,
            { upsert: true }
          );

          if (--remaining_tasks <= 0) task_finish();
        }
      })));

      await relimit_wait;

      relimit.removeListener('error', task_error);

      if (needs_rebuild) await params.rebuild(msg_id);
      if (needs_restart) await this.restart(true);
    }
  });
};
