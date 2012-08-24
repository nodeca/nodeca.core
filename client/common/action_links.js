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


/*global $, _, nodeca*/


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
    $('body').on('click.nodeca.data-api', '[data-action]', function (event) {
      var $this = $(this), api_path = String($this.data('action'));

      loadAssets(api_path.split('.').shift(), function () {
        var func = nodeca.shared.common.getByPath(nodeca.client, api_path);

        if (!_.isFunction(func)) {
          nodeca.logger.error('Action ' + $this.data('action') + ' not found');
          return;
        }

        func($this, event);
      });

      return false;
    });
  });
};
