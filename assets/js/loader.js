//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


window.nodeca = {
  client: {},
  server: {},
  shared: {},
  runtime: {
    load: function (assets, type) {
      var list = [], asset;

      // get copy of array
      assets = assets.slice();

      while (assets.length) {
        asset = assets.shift();
        if (!type || type === asset.type) {
          list.push(asset.link);
        }
      }

      yepnope(list);
    }
  }
};
