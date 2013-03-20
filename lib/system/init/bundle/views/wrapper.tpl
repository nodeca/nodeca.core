NodecaLoader.execute(function (N) {
  <% _.forEach(views, function (code, apiPath) { %>
    N.views[${JSON.stringify(apiPath)}] = (${code});
  <% }); %>
});
