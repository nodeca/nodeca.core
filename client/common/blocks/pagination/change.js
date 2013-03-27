'use strict';


var getFormData = require('nodeca.core/lib/client/get_form_data');


N.wire.on(module.apiPath, function pagination_change(event) {
  var $form = $(event.currentTarget)
    , data  = $form.data('pagination');

  if (!data) {
    return;
  }

  $.extend(data.params, getFormData($form));
  N.wire.emit('navigate.to', { apiPath: data.route, params: data.params });
});
