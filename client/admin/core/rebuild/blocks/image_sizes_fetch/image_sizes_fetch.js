// Display image meta fetch progress in admin interface
//
'use strict';


var ko = require('knockout');


// Knockout bindings root object.
var view = null;
var SELECTOR = '#rebuild-image-sizes-fetch-task';
var ignore_runid = 0;
var last_runid = 0;


function update_task_status(task_info) {
  if (!view) return;

  if (ignore_runid >= task_info.runid || last_runid > task_info.runid) {
    // task is finished, but we're still receiving debounced messages
    return;
  }

  view.current(task_info.current);
  view.total(task_info.total);

  // if task is running, but we're at 100%, set "started: false" because
  // we'll receive no more notifications
  if (task_info.current === task_info.total &&
      task_info.current > 0 &&
      task_info.total > 0) {
    view.started(false);
    ignore_runid = Math.max(ignore_runid, task_info.runid);
  } else {
    view.started(true);
  }

  last_runid = Math.max(task_info.runid, last_runid);
}


N.wire.on('navigate.done:admin.core.rebuild', function rebuild_image_sizes_fetch_widget_setup() {
  if (!$(SELECTOR).length) return;

  var current = N.runtime.page_data.image_sizes_fetch_task.current || 0;
  var total   = N.runtime.page_data.image_sizes_fetch_task.total || 1;

  view = {
    started:  ko.observable(current > 0 && current < total),
    current:  ko.observable(current),
    total:    ko.observable(total)
  };

  ko.applyBindings(view, $(SELECTOR)[0]);

  N.live.on('admin.core.rebuild.image_sizes_fetch', update_task_status);
});


N.wire.on('navigate.exit:admin.core.rebuild', function rebuild_image_sizes_fetch_widget_teardown() {
  if (!$(SELECTOR).length) return;

  view = null;
  ko.cleanNode($(SELECTOR)[0]);

  N.live.off('admin.core.rebuild.image_sizes_fetch', update_task_status);
});


N.wire.once('navigate.done:admin.core.rebuild', function rebuild_image_sizes_fetch_widget_setup_handlers() {

  // Click on "start" button
  //
  N.wire.on(module.apiPath + '.start', function rebuild_start() {
    var prev_runid = last_runid;

    N.io.rpc('admin.core.rebuild.image_sizes_fetch.start')
      .then(function () {
        // reset progress bar to zero,
        // and ignore all updates on the last task
        ignore_runid = Math.max(prev_runid, ignore_runid);
        view.current(0);
        view.total(1);
        view.started(true);
      });
  });


  // Click on "stop" button
  //
  N.wire.on(module.apiPath + '.stop', function rebuild_stop() {
    var prev_runid = last_runid;

    N.io.rpc('admin.core.rebuild.image_sizes_fetch.stop')
      .then(function () {
        // reset progress bar to zero,
        // and ignore all updates on the last task
        ignore_runid = Math.max(prev_runid, ignore_runid);
        view.current(0);
        view.total(1);
        view.started(false);
      });
  });
});
