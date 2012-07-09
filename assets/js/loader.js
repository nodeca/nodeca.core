//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


var assets_loader = window.assets_loader = (function () {
  function collect(obj, prop) {
    var out = [], i, l;

    for (i in obj) {
      if (obj.hasOwnProperty(i) && obj[i][prop]) {
        out.push(obj[i][prop]);
      }
    }

    return out;
  }

  function assets_loader(assets, callback) {
    yepnope({load: collect(assets, 'link'), complete: callback});
  };

  return assets_loader;
}());
