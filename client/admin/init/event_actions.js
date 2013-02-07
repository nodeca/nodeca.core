'use strict';


/**
 *  client
 **/

/**
 *  client.admin
 **/

/**
 *  client.admin.init
 **/


/*global $, _, N, loadAssets*/


var getByPath = require("../../../lib/getByPath");


function handleAction(event, $el, apiPath) {
  loadAssets(apiPath.split('.').shift(), function () {
    var func = getByPath(N.client, apiPath);

    if (!_.isFunction(func)) {
      N.logger.error('Action %s not found', apiPath);
      return;
    }

    func($el, event);
  });

  return false;
}


/**
 *  client.admin.init.event_actions()
 *
 *  Assigns handlers/listeners for `[data-action]` links.
 *  Actions associated with link will be called with `($el, event)`
 *
 *
 *  ##### Example
 *
 *      nodeca.client.admin.actions.init();
 **/
module.exports = function () {
  $(function () {
    $('body').on('click.nodeca.data-api', '[data-on-click]', function (event) {
      var $this = $(this), apiPath = $this.data('on-click');
      return handleAction(event, $this, apiPath);
    });

    $('body').on('submit.nodeca.data-api', '[data-on-submit]', function (event) {
      var $this = $(this), apiPath = $this.data('on-submit');
      return handleAction(event, $this, apiPath);
    });

    $('body').on('input.nodeca.data-api', '[data-on-input]', function (event) {
      var $this = $(this), apiPath = $this.data('on-input');
      return handleAction(event, $this, apiPath);
    });

    $('body').on('change.nodeca.data-api', '[data-on-change]', function (event) {
      var $this = $(this), apiPath = $this.data('on-change');
      return handleAction(event, $this, apiPath);
    });
  });
};
