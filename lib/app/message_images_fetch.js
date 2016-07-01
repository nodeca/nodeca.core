// Create worker to fetch images from remote servers and store their size to image_info
//
// params:
//
// - task_name (String)
// - find (Function => Promise) - `function (id)`
// - update (Function => Promise) - `function (id, data)`
// - rebuild (Function => Promise) - `function (id)`
//
'use strict';


const _        = require('lodash');
const Promise  = require('bluebird');
const co       = require('bluebird-co').co;
const get_size = require('probe-image-size');


// a number of times the task can be re-created if image fetch errors out
const MAX_RETRIES = 2;


module.exports = function (N, params) {
  N.queue.registerWorker({
    name: params.task_name,

    // 5 minute delay by default
    postponeDelay: 5 * 60 * 1000,

    timeout: 120000,

    taskID(taskData) {
      return taskData.msg_id;
    },

    * process() {
      let update        = {};
      let needs_rebuild = false;
      let needs_restart = false;
      let msg_id       = this.data.msg_id;
      let retry_count   = this.data.retry || 0;
      let flush_promise;
      let interval;

      // Put pending data from "update" object into a database.
      //
      function flush_data() {
        if (_.isEmpty(update)) return Promise.resolve();

        return params.find(msg_id).then(post => {
          if (!post) return;

          let updateData = { $set: {} };

          Object.keys(update).forEach(key => {
            if (_.isObject(post.image_info) && post.image_info[key] === null) {
              updateData.$set['image_info.' + key] = update[key];
            }
          });

          update = {};

          return params.update({ _id: post._id }, updateData);
        });
      }

      // write image info into database once every 10 sec
      // (in addition to writing after all images are retrieved)
      interval = setInterval(function () {
        flush_promise = flush_data();
      }, 10000);

      let post = yield params.find(msg_id);

      if (!post || !_.isObject(post.image_info)) return;

      const extendDeadline = _.throttle(() => {
        this.setDeadline();
      }, 10000);

      yield Promise.map(Object.keys(post.image_info), co.wrap(function* (key) {
        extendDeadline();

        // if it's not an external image (e.g. attachment), skip
        if (!key.match(/^url:/)) return;

        // if it's already loaded, skip
        if (post.image_info[key]) return;

        // key is "prefix"+"url with replaced dots", example:
        // url:http://example．com/foo．jpg
        let url = key.slice(4).replace(/．/g, '.');

        let result;

        try {
          result = yield get_size(url);
        } catch (err) {
          // if we can't parse file or status code is 4xx, this request is final
          let url_failed = (err.code === 'ECONTENT') ||
            (err.status && err.status >= 400 && err.status < 500);

          if (url_failed || retry_count >= MAX_RETRIES) {
            update[key] = { error: err.status || err.message };
          } else {
            needs_restart = true;
          }

          return;
        }

        update[key] = _.omitBy({
          width:  result.width,
          height: result.height,
          wUnits: result.wUnits,
          hUnits: result.hUnits,
          length: result.length
        }, _.isUndefined);

        needs_rebuild = true;
      }, { concurrency: 4 }));

      clearInterval(interval);

      // wait for flush_data called on interval, and then call
      // flush_data again just to be sure
      if (flush_promise) yield flush_promise;
      yield flush_data();

      if (needs_restart) {
        N.queue.worker(params.task_name).postpone({
          msg_id,
          retry: retry_count + 1
        });
      }

      if (needs_rebuild) {
        yield params.rebuild(msg_id);
      }
    }
  });
};
