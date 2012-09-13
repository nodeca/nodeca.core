"use strict";

/*global nodeca, _*/

var AuthLink = nodeca.models.core.AuthLink;
var User = nodeca.models.users.User;

// Validate input parameters
//
var params_schema = {
  email: {
    type: "string",
    required: true
  },
  pass: {
    type: "string",
    minLenght: 8,
    required: true
  }
};
nodeca.validate(params_schema);


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
  var env = this;

  // FIXME get real back url
  var back_url = nodeca.runtime.router.linkTo('forum.index');

  var ip = env.request.ip;

  env.session['profile'] =  null;

  // try find user by email or nick
  AuthLink.findOne().or([{'email': params.email}, {'auth_data.nick': params.email}])
      .exec(function(err, link) {
    if (err) {
      next(err);
      return;
    }
    if (!!link && link.checkPass(params.pass)) {
      // user found and say correct password
      User.findOne({ '_id': link.user_id }).exec(function(err, user) {
        if (err){
          next(err);
          return;
        }
        env.session['profile'] = user;
        env.skip.push('renderer');
        env.response.statusCode = 302;
        env.response.headers.Location = back_url;
        next();
      });
    }
    else {
      // user not found or wrong password
      next({ statusCode: 401, message: 'Authentication failed' });
    }
  });
};
