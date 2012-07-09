//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


(function (nodeca) {
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


  nodeca.runtime.load = function (assets, callback) {
    var i, l, d = new DefferedAssets(callback);

    // simple version of Array#forEach
    for (i = 0, l = assets.length ; i < l ; i++) {
      if ('css' === assets[i].type && assets[i].media) {
        yepnope.injectCss(assets[i].link, d.listen(), {media: assets[i].media});
      } else {
        yepnope({load: assets[i].link, complete: d.listen()});
      }
    }

    d.wait();
  };


  nodeca.runtime.init = function (assets, routes) {
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
}(window.nodeca || window.nodeca = {}));
