"use strict";

/*global nodeca, _*/

// form params description
//
var form_params_schema = {
  // forum id
  email: {
    type: "email",
    minimum: 1,
    required: true
  },
  pass: {
    type: "password",
    minimum: 8,
    required: true
  }
};


// fields can be fwtched from oauth provider
var profile_in_fields = [
  'email',
  'first_name',
  'last_name',
  'nick'
];


nodeca.validate();


// bind provider to account
//
module.exports = function (params, next) {
  this.response.data.predefined = {};
  this.response.data.form_fields = form_params_schema;
  if (this.session.auth_data) {
    // set predefined data from proveder
    this.response.data.predefined = _.pick(this.session.auth_data, _.keys(profile_in_fields));
  }
  next();
};
