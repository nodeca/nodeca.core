"use strict";


/*global nodeca*/


module.exports = function (params, callback) {
  this.response.data = params;
  callback();
};
