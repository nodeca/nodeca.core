/*global $*/

$(function () {
  'use strict';
  $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function ( e ) {
    e.preventDefault();
  });
});
