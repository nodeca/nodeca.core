'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.menus
 **/


/*global $, _*/


/**
 *  client.common.menus.activate(route)
 *  - route (String): Server API path
 *
 *  Sets `cssClass` for menu items of `route`.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.menus.activate('forums.index');
 **/
module.exports.activate = function (route) {
  // unset any active menu items
  $('[data-api3-route], [data-api3-namespace]').removeClass('active');

  // set new active menu items
  $('[data-api3-route="' + route + '"], [data-api3-namespace="' +
    route.split('.').shift() + '"]').addClass('active');
};
