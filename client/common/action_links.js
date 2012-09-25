'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.action_links
 **/


/*global $, _, nodeca, loadAssets*/


function handleAction(event, $el, apiPath) {
  loadAssets(apiPath.split('.').shift(), function () {
    var func = nodeca.shared.common.getByPath(nodeca.client, apiPath);

    if (!_.isFunction(func)) {
      nodeca.logger.error('Action ' + apiPath + ' not found');
      return;
    }

    func($el, event);
  });

  return false;
}


/**
 *  client.common.action_links.init()
 *
 *  Assigns handlers/listeners for `[data-action]` links.
 *  Actions associated with link will be called with `($el, event)`
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.action_links.init();
 **/
module.exports.init = function () {
  $(function () {
    $('body').on('click.nodeca.data-api', '[data-on-click]', function (event) {
      var $this = $(this), apiPath = $this.data('on-click');
      return handleAction(event, $this, apiPath);
    });

    $('body').on('submit.nodeca.data-api', '[data-on-submit]', function (event) {
      var $this = $(this), apiPath = $this.data('on-submit');
      return handleAction(event, $this, apiPath);
    });

    $('body').on('change.nodeca.data-api', '[data-on-change]', function (event) {
      var $this = $(this), apiPath = $this.data('on-change');
      return handleAction(event, $this, apiPath);
    });
  });
};
