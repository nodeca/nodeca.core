/*global nodeca, $*/


//= require nodeca


nodeca.io.init();


$(function () {
  'use strict';

  var $online = $('#online');
  nodeca.io.subscribe('/stats/users_online', function (count) {
    $online.text(count);
  }).fail(function (err) {
    nodeca.logger.error('Failed subscribe for stats updates: ' + err);
  });
});
