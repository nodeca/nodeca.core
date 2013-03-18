define(<%= JSON.stringify(name) %>, null, <%= JSON.stringify(root) %>, function (exports, module, require, N, t) {
  <%= source %>
});
require(<%= JSON.stringify(name) %>);
