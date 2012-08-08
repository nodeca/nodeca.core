"use strict";


/**
 *  server
 **/

/**
 *  server.common
 **/


/*global nodeca*/


// nodeca
var NLib = require('nlib');


// 3rd-party
var Async = NLib.Vendor.Async;


// internal
var get_menu_permissions = require('nodeca.core/lib/menu').get_menu_permissions;


////////////////////////////////////////////////////////////////////////////////


// Validate input parameters
//
var params_schema = {
  menu_ids: {
    type: "array",
    required: true,
    items: {
      type: "integer",
    },
    minItems: 1
  }
}
nodeca.validate(params_schema);


/**
 *  server.common.permissions(params, callback) -> Void
 *
 *  Returns menu permissions map.
 *
 *
 *  ##### Params
 *
 *  - **menu_ids** (Array): List of menu ids to get permissions map for.
 *
 *
 *  ##### Response data
 *
 *  - **data.permissions** (Object): Permissions map
 *
 *
 *  ##### See Also:
 *
 *  - [[lib.menu.get_menu_permissions]]
 **/
module.exports = function (params, callback) {
  var data = this.response.data;

  if (!this.origin.rpc) {
    callback({statusCode: 400, body: "RPC ONLY"});
    return;
  }

  get_menu_permissions(params.menu_ids, this, function (err, permissions) {
    data.permissions = permissions;
    callback(err);
  });
};
