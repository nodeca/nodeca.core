// Create worker to fetch images from remote servers and cache their size
//
// params:
//
// - task_name (String)
// - find (Function => Promise) - `function (id)`
// - rebuild (Function => Promise) - `function (id)`
//
'use strict';


const _        = require('lodash');
const $        = require('nodeca.core/lib/parser/cheequery');
const Promise  = require('bluebird');
const get_size = require('probe-image-size');


// a number of times the task can be re-created if image fetch errors out
const MAX_RETRIES = 2;


module.exports = function (N, params) {
  N.queue.registerTask({
    name: params.task_name,

    // 5 minute delay by default
    postponeDelay: 5 * 60 * 1000,

    timeout: 120000,

    taskID(args) {
      return String(args[0]);
    },

    process: Promise.coroutine(function* (msg_id, retry) {
      const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);
      const statuses       = N.models.core.ImageSizeCache.statuses;

      let post   = yield params.find(msg_id);

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
      let retry_count   = retry || 0;

      let url_sizes = yield N.models.core.ImageSizeCache
                               .where('url').in(images)
                               .where('status').equals(statuses.PENDING)
                               .lean(true);

      yield Promise.map(url_sizes, Promise.coroutine(function* (u) {
        extendDeadline();

        let url = u.url;
        let cache = { url: u.url, rand: u.rand };
        let result;
        let err;

        try {
          result = yield get_size(url);
        } catch (_err) {
          err = _err;
        }

        if (err) {
          let url_failed   = (err.code === 'ECONTENT') ||
                             (err.status && err.status >= 400 && err.status < 500);

          cache.status     = url_failed ? statuses.ERROR_FATAL : statuses.ERROR_RETRY;
          cache.error      = err.message;
          cache.error_code = err.status || err.code;

          // if it's a temporary failure, restart this task later
          if (!url_failed && retry_count < MAX_RETRIES) {
            needs_restart = true;
          }
        } else {
          cache.status     = statuses.SUCCESS;

          cache.value      = {
            width:  result.width,
            wUnits: result.wUnits,
            height: result.height,
            hUnits: result.hUnits,
            length: result.length
          };

          // if we got at least one image, rebuild the post
          needs_rebuild = true;
        }

        // Replace old object with the new one to reset any previously
        // fetched results (i.e. error status codes). Use native method
        // to avoid auto-$set.
        //
        yield N.models.core.ImageSizeCache.collection.update(
          { url },
          cache,
          { upsert: true }
        );
      }), { concurrency: 4 });

      if (needs_restart) {
        N.queue.worker(params.task_name).postpone({
          msg_id,
          retry: retry_count + 1
        });
      }

      if (needs_rebuild) {
        yield params.rebuild(msg_id);
      }
    })
  });
};
