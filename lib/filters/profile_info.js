'use strict';

var session_fields = [
  '_uname',
  '_uname_short'
];

/*global nodeca, _*/

// Filter middleware that put user info from profile to response data
//
//
nodeca.filters.after('', { weight: 100 }, function (params, callback) {
  console.dir(this.session.profile);
  console.dir(this.response.data.profile);
  this.response.data.profile = null;
  if (!!this.session.profile) {
    this.response.data.profile = _.pick(this.session.profile, session_fields);
  }
  callback();
});
