/*global nodeca, $*/


//= require nodeca


nodeca.io.init();


$(function () {
  'use strict';
  $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function ( e ) {
    // Bootstrap.Collapse calls e.preventDefault() only when there's no
    // data-target attribute. We don't want URL to be changed, so we are
    // forcing prevention of default behavior.
    e.preventDefault();
  });
});
