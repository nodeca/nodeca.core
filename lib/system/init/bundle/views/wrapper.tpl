(function () {
  <% _.forEach(views, function (code, apiPath) { %>
    this[<%= JSON.stringify(apiPath) %>] = (<%= code %>);
  <% }); %>
}).call(<%= namespace %> || (<%= namespace %> = {}));
