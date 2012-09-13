"use strict";

/*global nodeca, _*/


nodeca.validate();


/**
 * login.email(params, next) -> Void
 *
 * ##### params
 *
 * - `email`      user email or nick
 * - `pass`       user password
 *
 * login by email provider
 **/
module.exports = function (params, next) {
  console.dir('----logout-----');
  this.session['profile'] = null;
  this.skip.push('renderer');
  this.response.statusCode = 302;
  this.response.headers.Location = nodeca.runtime.router.linkTo('forum.index');
  next();
};
