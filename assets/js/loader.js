//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


window.nodeca = {
  client: {},
  server: {},
  shared: {},
  runtime: {
    load: function (assets) {
      var i, l;

      // simple version of Array#forEach
      for (i = 0, l = assets.length ; i < l ; i++) {
        if ('css' === assets[i].type && assets[i].media) {
          yepnope.injectCss(assets[i].link, {media: assets[i].media});
        } else {
          yepnope(assets[i].link);
        }
      }
    }
  }
};
