"use strict";

/*global nodeca, _*/

var AuthLink = nodeca.models.core.AuthLink;
var User = nodeca.models.users.User;


// Validate input parameters
//
var params_schema = {
  email: {
    type: "string",
    format: "email",
    required: true
  },
  pass: {
    type: "string",
    minLenght: 8,
    required: true
  },
  nick: {
    type: "string",
    required: true
  },
  first_name: {
    type: "string",
    required: true
  },
  last_name: {
    type: "string",
    required: true
  }
};
nodeca.validate(params_schema);



// login by provider
//
// ##### params
//
module.exports = function (params, next) {
  var env = this;
  var user,
      link;

  // FIXME get real buck url
  var back_url = nodeca.runtime.router.linkTo('forum.index');


  // check existing links
  AuthLink.find({ 'email': params.email }).setOptions({ lean: true })
      .limit(1).exec(function(err, docs){
    if (err) {
      next(err);
      return;
    }
    if (docs.length !== 0) {
      // FIXME check statusCode
      next({ statusCode: 401, message: 'This email already exists' });
      return;
    }
    user = new User(params);
    user._last_visit_ts = user.joined_ts = new Date();
    user._last_visit_ip = env.request.ip;
    user.joined_ts = new Date();
    // FIXME set groups
    user.save(function(err, user) {
      if (err) {
        next(err);
        return;
      }
      link = new AuthLink({
        'provider': 'email',
        'email': params.email,
        'user_id': user._id,
        'auth_data': {
          'nick': user.nick
        }
      });
      link.setPass(params.pass);
      link.save(function(err, link){
        if (err) {
          next(err);
          return;
        }

        env.skip.push('renderer');
        env.response.statusCode = 302;
        env.response.headers.Location = back_url;
      });
    });
  });
};
