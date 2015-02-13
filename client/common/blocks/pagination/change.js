// Handles submits from pagination jump dropdowns
//

'use strict';


N.wire.on(module.apiPath, function pagination_change(data) {
  var pagination = data.$this.data('pagination');
  var page = +data.fields.page;

  if (!page) {
    return;
  }

  $.extend(pagination.params, { page: page });
  N.wire.emit('navigate.to', { apiPath: pagination.route, params: pagination.params });
});
