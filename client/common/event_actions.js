/**
 *  Assigns handlers/listeners for `[data-action]` links.
 *
 *  Actions associated with a link will be invoked via Wire with the jQuery
 *  event object as an argument.
 **/


'use strict';


/*global NodecaLoader, N, window*/


var $ = window.jQuery;


function handleAction(apiPath, event) {
  NodecaLoader.loadAssets(apiPath.split('.')[0], function () {
    if (N.wire.has(apiPath)) {
      N.wire.emit(apiPath, event);
    } else {
      N.logger.error('Unknown client Wire channel: %s', apiPath);
    }
  });

  event.preventDefault();
  return false;
}


$(function () {
  $('body').on('click.nodeca.data-api', '[data-on-click]', function (event) {
    var apiPath = $(this).data('onClick');
    return handleAction(apiPath, event);
  });

  $('body').on('submit.nodeca.data-api', '[data-on-submit]', function (event) {
    var apiPath = $(this).data('onSubmit');
    return handleAction(apiPath, event);
  });

  $('body').on('input.nodeca.data-api', '[data-on-input]', function (event) {
    var apiPath = $(this).data('onInput');
    return handleAction(apiPath, event);
  });

  $('body').on('change.nodeca.data-api', '[data-on-change]', function (event) {
    var apiPath = $(this).data('onChange');
    return handleAction(apiPath, event);
  });
});
