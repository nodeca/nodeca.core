// Handles submits from pagination jump dropdowns
//

'use strict';


N.wire.on(module.apiPath, function pagination_change(form) {
  var data = form.data.pagination;
  var page = +form.fields.page;

  if (!page) {
    return;
  }

  $.extend(data.params, { page: page });
  N.wire.emit('navigate.to', { apiPath: data.route, params: data.params });
});
