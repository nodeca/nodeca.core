// Build cache for all previously collected urls
//
'use strict';

const _  = require('lodash');

const BATCH_SIZE_READ  = 500;
const MIN_PENDING      = 1000;


module.exports = function (N) {

  N.wire.on('init:jobs', function register_expand_links_cache() {

    N.queue.registerTask({
      name: 'expand_links_cache',
      pool: 'hard',
      timeout: 180000,
      taskID: () => 'expand_links_cache',
      async process() {
        let task_name = this.name;

        N.logger.info(`${task_name}: task started`);

        const extendDeadline = _.throttle(() => this.setDeadline(180000), 10000);
        const statuses = N.models.core.UrlTracker.statuses;

        // info for progress bar in admin control panel
        let uid = this.uid;
        let current = 0;
        let total = await N.models.core.UrlTracker.count()
                              .where('status').equals(statuses.PENDING);

        let get_url_block_last_id;
        let get_url_block_running = false;
        let get_url_block_finished = false;
        let task_aborted;
        let pending = 0;
        let finish_task;
        let wait_for_finish = new Promise(resolve => { finish_task = resolve; });

        async function get_url_block() {
          function add_url(url) {
            pending++;

            // embed is running in the background here
            N.wire.emit('internal:common.embed', { url, types: [ 'block', 'inline' ], bulk: true }).then(() => {
              extendDeadline();

              current++;

              N.live.debounce('admin.core.rebuild.expand_links_cache', {
                uid,
                current,
                total
              });

              pending--;

              if (pending < MIN_PENDING) get_url_block();
              if (pending <= 0 && get_url_block_finished) finish_task();
            });
          }

          if (task_aborted) return;
          if (get_url_block_running) return;
          if (get_url_block_finished) return;
          get_url_block_running = true;

          let query = N.models.core.UrlTracker.find()
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

          for (let u of chunk) add_url(u.url);

          get_url_block_running = false;
        }

        await get_url_block();

        let monitor_timer = setInterval(async () => {
          try {
            let task = await this.queue.getTask(this.id);

            if (!task || task.uid !== this.uid || task.state !== 'locked') {
              task_aborted = true;
              finish_task();
              clearInterval(monitor_timer);
              return;
            }
          } catch (err) {
            N.logger.error(`${task_name}: ${err.message || err}`);
            clearInterval(monitor_timer);
            task_aborted = true;
            finish_task();
          }
        }, 5000);

        await wait_for_finish;

        clearInterval(monitor_timer);

        N.logger.info(`${task_name}: task ${task_aborted ? 'aborted' : 'succeeded'}`);
      }
    });

    N.queue.on('task:end:expand_links_cache', function (task_info) {
      return N.live.emit('admin.core.rebuild.expand_links_cache', {
        uid:      task_info.uid,
        finished: true
      });
    });
  });
};
