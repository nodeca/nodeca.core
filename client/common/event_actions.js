/**
 *  Assigns handlers/listeners for `[data-action]` links.
 *
 *  Actions associated with a link will be invoked via Wire with the jQuery
 *  event object as an argument.
 **/


'use strict';


/*global NodecaLoader, N, window*/


var $ = window.jQuery;


$(function () {
  ['click', 'submit', 'input'].forEach(function (action) {
    var eventName = action + '.nodeca.data-api'
      , attribute = '[data-on-' + action + ']';

    $('body').on(eventName, attribute, function (event) {
      var apiPath = $(this).data('on-' + action);

      NodecaLoader.loadAssets(apiPath.split('.').shift(), function () {
        if (N.wire.has(apiPath)) {
          N.wire.emit(apiPath, event);
        } else {
          N.logger.error('Unknown client Wire handler: %s', apiPath);
        }
      });

      event.preventDefault();
      return false;
    });
  });
});
