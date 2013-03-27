/**
 *  Assigns basic event listeners and handlers.
 **/


'use strict';


$(function () {
  // Bootstrap.Collapse calls e.preventDefault() only when there's no
  // data-target attribute. We don't want URL to be changed, so we are
  // forcing prevention of default behavior.
  $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function (e) {
    e.preventDefault();
  });
});
