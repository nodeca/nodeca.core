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


/*global $, _*/


/**
 *  client.common.navbar_menu.activate(route)
 *  - route (String): Server API path
 *
 *  Sets `cssClass` for menu items of `route`.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.navbar_menu.activate('forums.index');
 **/
module.exports.activate = function (route) {
  var ns = route.split('.').shift();

  $('#navbar_menu')
    .find('[data-api3-route]').removeClass('active').end()
    //
    // activate any element with same namespace as `route`:
    //
    //     route = 'foo.bar'
    //
    // will highlight elements with `[data-api3-route="foo"]`.
    //
    .find('[data-api3-route="' + ns + '"]').addClass('active');
};
