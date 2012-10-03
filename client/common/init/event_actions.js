'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.init
 **/


/*global $, _, nodeca, loadAssets*/


function handleAction(event, $el, apiPath) {
  loadAssets(apiPath.split('.').shift(), function () {
    var func = nodeca.shared.getByPath(nodeca.client, apiPath);

    if (!_.isFunction(func)) {
      nodeca.logger.error('Action ' + apiPath + ' not found');
      return;
    }

    func($el, event);
  });

  return false;
}


/**
 *  client.common.init.event_actions()
 *
 *  Assigns handlers/listeners for `[data-action]` links.
 *  Actions associated with link will be called with `($el, event)`
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.actions.init();
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
  });
};
