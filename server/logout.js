"use strict";

/*global nodeca, _*/


nodeca.validate();

// logout
//
// ##### params
//
module.exports = function (params, next) {
  this.session['user'] = null;
  console.dir(this.session);
  console.dir('---------logout----------');
  var back_url = nodeca.runtime.router.linkTo('forum.index');
  next({
    statusCode: 302,
    //FIXME redirect to source page
    headers: {'Location': back_url}
  });
};
