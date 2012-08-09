'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.navbar_menu
 **/


/*global $*/


/**
 *  client.common.navbar_menu.activate(apiPath)
 *  - apiPath (String): Server API path
 *
 *  Sets `cssClass` for menu items of `route`.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.navbar_menu.activate('forums.index');
 **/
module.exports.activate = function (apiPath) {
  var ns = apiPath.split('.').shift();

  $('#navbar_menu')
    .find('[data-api3-path]').removeClass('active').end()
    //
    // activate any element with same namespace as `route`:
    //
    //     route = 'foo.bar'
    //
    // will highlight elements with `[data-api3-path="foo"]`.
    //
    .find('[data-api3-path="' + ns + '"]').addClass('active');
};
