NodecaLoader.registerNodeModule(<%= JSON.stringify(path) %>, function (/* N, */require, module, exports) {
  ${source}
}, <%= JSON.stringify(dependencies) %>);
