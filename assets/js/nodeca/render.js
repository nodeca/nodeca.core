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
    var html = find_fn(path)(data);

    console.log(html, data);
    alert('Not implemented yet');
  };
}());
