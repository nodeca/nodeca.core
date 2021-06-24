// Download metadata for all images
//
'use strict';


const _            = require('lodash');
const probe        = require('probe-image-size');
const probe_pkg    = require('probe-image-size/package.json');
const Relimit      = require('relimit');
const url          = require('url');
const limits       = require('nodeca.core/lib/app/relimit_limits');

const BATCH_SIZE_READ  = 10000;
const BATCH_SIZE_WRITE = 100;
const MIN_PENDING      = 50000;
const MAX_CONNECTIONS  = 100;


module.exports = function (N) {

  let rootUrl = _.get(N.config, 'bind.default.mount', 'http://localhost') + '/';
  let userAgent = `${probe_pkg.name}/${probe_pkg.version} (Nodeca; +${rootUrl})`;

  N.wire.on('init:jobs', function register_image_sizes_fetch() {

    function normalize(item) {
      return (url.parse(item.url).hostname || '');
    }

    N.queue.registerTask({
      name: 'image_sizes_fetch',
      pool: 'hard',
      timeout: 180000,
      taskID: () => 'image_sizes_fetch',
      async process() {
        let task_name = this.name;

        N.logger.info(`${task_name}: task started`);

        const extendDeadline = _.throttle(() => this.setDeadline(180000), 10000);
        const statuses = N.models.core.ImageSizeCache.statuses;

        // info for progress bar in admin control panel
        let uid = this.uid;
        let current = 0;
        let total = await N.models.core.ImageSizeCache.countDocuments()
                              .where('status').equals(statuses.PENDING);

        let get_url_block_last_id;
        let get_url_block_running = false;
        let get_url_block_finished = false;
        let task_aborted;
        let relimit;

        let bulk = N.models.core.ImageSizeCache.collection.initializeUnorderedBulkOp();

        // {
        //   errors:     Number, // amount of successive timeouts
        //   successes:  Number,
        //   last_error: Date
        // }
        let domain_stats = Object.create(null);

        async function get_url_block() {
          if (task_aborted) return;
          if (get_url_block_running) return;
          if (get_url_block_finished) return;
          get_url_block_running = true;

          let query = N.models.core.ImageSizeCache.find()
                          .where('status').equals(statuses.PENDING)
                          .sort('_id')
                          .limit(BATCH_SIZE_READ);

          if (get_url_block_last_id) {
            query = query.where('_id').gt(get_url_block_last_id);
          }

          let chunk = await query.lean(true);

          if (chunk.length === 0) {
            get_url_block_finished = true;
            get_url_block_running = false;
            return;
          }

          get_url_block_last_id = chunk[chunk.length - 1]._id;
          relimit.push(chunk);
          get_url_block_running = false;
        }

        async function write_bulk() {
          let b = bulk;
          bulk = N.models.core.ImageSizeCache.collection.initializeUnorderedBulkOp();
          await b.execute();

          N.logger.info(`${task_name}: ${current}/${total}, ${relimit.stat().active} active, ` +
            `${relimit.stat().pending} pending`);
        }

        relimit = new Relimit({
          scheduler: (N.config.database || {}).redis,
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
            if (task_aborted) return;

            extendDeadline();

            let url = item.url;
            let domain = normalize(item);
            let result;
            let err;
            let ts_begin = new Date();

            if (!domain_stats[domain]) {
              domain_stats[domain] = {
                errors:     0,
                successes:  0,
                last_error: 0
              };
            }

            try {
              if (domain_stats[domain].errors >= 30 ||
                  (domain_stats[domain].errors >= 2 && !domain_stats[domain].successes)) {
                let e = new Error('Domain blacklisted, too many timeouts');
                e.code = 'EBLACKLISTED';
                throw e;
              }

              result = await probe(url, {
                headers: { 'User-Agent': userAgent },
                open_timeout: 15000,
                response_timeout: 120000,
                read_timeout: 120000
              });
            } catch (_err) {
              err = _err;
            }

            if (err && err.code === 'ETIMEDOUT') {
              let now = Date.now();

              if (now - domain_stats[domain].last_error >= 120000) {
                domain_stats[domain].errors++;
                domain_stats[domain].last_error = now;

                if (domain_stats[domain].errors >= 30 ||
                    (domain_stats[domain].errors >= 2 && !domain_stats[domain].successes)) {
                  let errors = domain_stats[domain].errors;
                  N.logger.error(`${task_name}: domain ${domain} blacklisted, too many timeouts (${errors})`);
                }
              }
            } else if (!(err && err.code === 'EBLACKLISTED')) {
              domain_stats[domain].errors = 0;
              domain_stats[domain].successes++;
              domain_stats[domain].last_error = 0;
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

              bulk.find({ _id: item._id }).replaceOne({
                url:        item.url,
                retries:    (item.retries || 0) + 1,
                status:     is_fatal ? statuses.ERROR_FATAL : statuses.ERROR_RETRY,
                error:      err.message,
                error_code: err.statusCode || err.code,
                ts_begin,
                ts_end:     new Date()
              });

            } else {
              bulk.find({ _id: item._id }).replaceOne({
                url:     item.url,
                retries: (item.retries || 0) + 1,
                status:  statuses.SUCCESS,
                value:   result,
                ts_begin,
                ts_end:     new Date()
              });
            }

            if (bulk.length >= BATCH_SIZE_WRITE) {
              await write_bulk();
            }

            if (relimit.stat().pending < MIN_PENDING) {
              await get_url_block();
            }

            current++;

            await N.live.debounce('admin.core.rebuild.image_sizes_fetch', {
              uid,
              current,
              total
            });
          }
        });

        await relimit.start();

        await get_url_block();

        let monitor_timer = setInterval(async () => {
          try {
            let task = await this.queue.getTask(this.id);

            if (!task || task.uid !== this.uid || task.state !== 'locked') {
              task_aborted = true;
              clearInterval(monitor_timer);
              await relimit.shutdown();
              return;
            }
          } catch (err) {
            N.logger.error(`${task_name}: ${err.message || err}`);
            clearInterval(monitor_timer);
            task_aborted = true;
          }
        }, 5000);

        await relimit.wait();

        clearInterval(monitor_timer);

        await relimit.shutdown();

        if (bulk.length > 0) await write_bulk();

        N.logger.info(`${task_name}: task ${task_aborted ? 'aborted' : 'succeeded'}`);
      }
    });

    N.queue.on('task:end:image_sizes_fetch', function (task_info) {
      return N.live.emit('admin.core.rebuild.image_sizes_fetch', {
        uid:      task_info.uid,
        finished: true
      });
    });
  });
};
