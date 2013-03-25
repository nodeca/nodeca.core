/**
 *  getFormData(form) -> Object
 *  - form (jQuery|DOMElement): Form to get data from.
 *
 *  Returns a hash table with names => values of the form.
 **/


'use strict';


/*global window*/


var $ = window.jQuery;


module.exports = function getFormData(form) {
  var data = {};

  $.each($(form).serializeArray(), function () {
    data[this.name] = this.value;
  });

  return data;
};
