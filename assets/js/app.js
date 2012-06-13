/*global nodeca, $*/


//= require nodeca
//= require nodeca-io


nodeca.io.init();


$(function () {
  'use strict';

  $(".collapse").collapse();

  var $online = $('#online');
  nodeca.io.subscribe('/stats/users_online', function (count) {
    $online.text(count);
  }).fail(function (err) {
    nodeca.logger.error('Failed subscribe for stats updates: ' + err);
  });
});
