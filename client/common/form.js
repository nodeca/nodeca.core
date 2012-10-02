'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.form
 **/


/*global $*/


/**
 *  client.common.form.getData(form) -> Object
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
