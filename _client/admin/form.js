'use strict';


/**
 *  client
 **/

/**
 *  client.admin
 **/

/**
 *  client.admin.form
 **/


/*global $*/


/**
 *  client.admin.form.getData(form) -> Object
 *  - form (jQuery|DOMElement): Form to get dat from
 *
 *  Returns Hash with values of form.
 **/
module.exports.getData = function getData(form) {
  var data = {};

  $.each($(form).serializeArray(), function () {
    data[this.name] = this.value;
  });

  return data;
};
