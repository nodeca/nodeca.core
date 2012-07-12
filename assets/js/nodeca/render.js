/**
 *  nodeca.render(view, data)
 *
 *  This module provides function for view rendering.
 **/


//= depend_on nodeca
//= require jade/runtime


/*global window, $, _, jade, nodeca*/


(function () {
  'use strict';


  var helpers = {};

  _.each(['t', 'asset_include', 'config', 'random', 'link_to', 'nodeca', 'jason'], function (name) {
    helpers[name] = function () {
      return name + "() is not implemented yet.";
    };
  });


  function find_fn(path) {
    var val = nodeca.views, parts = path.split('.');

    while (val && parts.length) {
      val = val[parts.shift()];
    }

    return val && val[1] || function () {
      alert("View " + path + " not found");
    };
  }


  nodeca.render = function (path, data) {
    var locals  = _.extend(data, helpers),
        html    = find_fn(path)(locals);
    $('[data-nodeca-layout-content]').html(html);
  };
}());
