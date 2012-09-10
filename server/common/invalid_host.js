'use strict';


module.exports = function (params, next) {
  var host = (this.origin.http || this.origin.rpc).req.headers.host;
  next('Invalid host ' + host);
};
