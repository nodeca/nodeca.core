/*global nodeca, $*/


//= require jquery
//= require underscore
//= require nodeca
//= require nodeca-io


$(function () {
  'use strict';

  nodeca.io.init();

  var $online = $('#online');
  nodeca.io.subscribe('/stats/users_online', function (count) {
    $online.text(count);
  }).fail(function (err) {
    nodeca.logger.error('Failed subscribe for stats updates: ' + err);
  });
});
