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


// Prepare Underscore tempalte of data attribute selector
var template = _.template('[data-api3-route="<%= route %>"]');


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
  var parts = route.split('.'), selectors = [];

  // unset any active menu items
  $('[data-api3-route]').removeClass('active');

  // prepare list of selectors
  while (parts.length) {
    selectors.push(template({route: parts.join('.')}));
    parts.pop();
  }

  // set new active menu items
  $(selectors.join(',')).addClass('active');
};
