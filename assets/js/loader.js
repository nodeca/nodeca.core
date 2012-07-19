//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


/*jshint browser:true,node:false*/
/*global yepnope*/


var load_assets = window.load_assets = (function () {
  'use strict';


  function collect(obj, prop) {
    var out = [], i;

    for (i in obj) {
      if (obj.hasOwnProperty(i) && obj[i][prop]) {
        out.push(obj[i][prop]);
      }
    }

    return out;
  }

  function noop() {}

  function load_assets(assets, callback) {
    callback = callback || noop;

    if (0 === assets.length) {
      callback();
      return;
    }

    yepnope({load: collect(assets, 'link'), complete: callback});
  }

  return load_assets;
}());
