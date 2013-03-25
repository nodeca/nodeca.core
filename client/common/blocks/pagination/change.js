'use strict';


/*global N, window*/


var $ = window.jQuery;
var getFormData = require('../../_get_form_data');


N.wire.on(module.apiPath, function pagination_change(event) {
  var $form = $(event.currentTarget)
    , data  = $form.data('pagination');

  if (data) {
    $.extend(data.params, getFormData($form));
    N.wire.emit('navigate.to', { apiPath: data.route, params: data.params });
  }
});
