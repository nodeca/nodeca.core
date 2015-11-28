'use strict';

function ping_show() {
  $('.ping-ticker').removeClass('active');
  setTimeout(function () {
    $('.ping-ticker').addClass('active');
  }, 0);
}

N.wire.on('navigate.done:' + module.apiPath, function dashboard_init() {
  N.live.on('admin.ping', ping_show);
});

N.wire.on('navigate.exit:' + module.apiPath, function dashboard_leave() {
  N.live.off('admin.ping', ping_show);
});
