/*global nodeca, $*/

//= require jquery/jquery
//= require underscore
//= require bootstrap/bootstrap
//= require babelfish-runtime
//= require pointer


$(function () {
  'use strict';

  var events = $.map(['show', 'shown', 'hide', 'hidden'], function (evt) {
    return evt + '.collapse.data-api';
  }).join(' ');

  $('body').on(events, '[data-notify]', function (event) {
    $( $(this).data('notify') ).trigger(event.type);
  });
});
