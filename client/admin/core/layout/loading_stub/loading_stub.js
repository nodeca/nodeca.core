// Render page on client-side
//
'use strict';


N.wire.before('navigate.done', { priority: -990 }, function render_first_page(data) {
  if (!$('#loading-stub-data').length) return;

  var locals = JSON.parse($('#loading-stub-data').text());

  var content = $(N.runtime.render(data.apiPath, locals, {
    apiPath: data.apiPath
  }));

  $('#content').replaceWith(content);
});
