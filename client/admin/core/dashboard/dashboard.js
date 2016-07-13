'use strict';


function ping_show() {
  $('.ping-ticker').removeClass('active');
  setTimeout(function () {
    $('.ping-ticker').addClass('active');
  }, 0);
}


N.wire.on('navigate.done:' + module.apiPath, function dashboard_ping_init() {
  N.live.on('admin.ping', ping_show);
});


N.wire.on('navigate.exit:' + module.apiPath, function dashboard_leave() {
  N.live.off('admin.ping', ping_show);
});


N.wire.once('navigate.done:' + module.apiPath, function dashboard_init() {

  // Turn online
  //
  N.wire.on(module.apiPath + ':turn_online', function dashboard_turn_online() {
    return N.io.rpc('admin.core.offline_mode_switch', { offline: false })
      .then(() => $('.dashboard-offline-mode').removeClass('dashboard-offline-mode__m-offline'));
  });


  // Confirm offline mode
  //
  N.wire.before(module.apiPath + ':turn_offline', function dashboard_turn_offline_confirm() {
    return N.wire.emit('admin.core.blocks.confirm', t('turn_offline_confirm'));
  });


  // Turn offline
  //
  N.wire.on(module.apiPath + ':turn_offline', function dashboard_turn_offline() {
    return N.io.rpc('admin.core.offline_mode_switch', { offline: true })
      .then(() => $('.dashboard-offline-mode').addClass('dashboard-offline-mode__m-offline'));
  });
});
