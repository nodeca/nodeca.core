//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


var nodeca = window.nodeca = (function (nodeca) {
  nodeca.client   = {};
  nodeca.server   = {};
  nodeca.shared   = {};
  nodeca.runtime  = {};


  // empty function
  function noop() {}


  function DefferedAssets(callback) {
    this.callback = callback || noop;
    this.waiting  = false;
    this.queue    = 0;
  }

  DefferedAssets.prototype.listen = function () {
    var self = this;

    self.queue++;

    return function () {
      self.queue--;
      self.done();
    };
  }

  DefferedAssets.prototype.done = function () {
    if (this.waiting && 0 === this.queue) {
      this.callback();
    }
  }

  DefferedAssets.prototype.wait = function () {
    this.waiting = true;
    this.done();
  };


  var cached_assets = {};


  nodeca.runtime.load = function (assets, callback) {
    var i, l, d = new DefferedAssets(callback);

    // simple version of Array#forEach
    for (i = 0, l = assets.length ; i < l ; i++) {
      // do not double-load assets - yep nope fires callbacks really strange
      if (!cached_assets[assets[i].link]) {
        cached_assets[assets[i].link] = true;
        if ('css' === assets[i].type && assets[i].media) {
          yepnope.injectCss(assets[i].link, d.listen(), {media: assets[i].media});
        } else {
          yepnope({load: assets[i].link, callback: d.listen()});
        }
      }
    }

    d.wait();
  };


  function filter(arr, test) {
    var result = [], i, l;

    for (i = 0, l = arr.length; i < l; i++) {
      if (test(arr[i])) {
        result.push(arr[i]);
      }
    }

    return result;
  }


  nodeca.runtime.init = function (assets, routes) {
    assets = filter(assets, function (asset) {
      cached_assets[asset.link] = ('css' === asset.type);
      return !cached_assets[asset.link];
    });

    // all css files are injected in the template, so git rid of them
    nodeca.runtime.load(assets, function () {
      var router = nodeca.runtime.router = new Pointer();

      _.each(routes, function (options) {
        var name = options.name;

        router.addRoute(options.pattern, {
          name: options.name,
          prefix: options.prefix,
          params: options.params,
          meta: {
            name: options.name,
            func: function (params, options, callback) {
              nodeca.io.apiTree(name, params, options, callback);
            }
          }
        });
      });
    });
  };

  return nodeca;
}({}));
