/**
 *  nodeca.render(view, data)
 *
 *  This module provides function for view rendering.
 **/


//= depend_on nodeca
//= require jade/runtime
//= require jason


/*global window, $, _, jade, JASON, nodeca*/


(function () {
  'use strict';


  // finds value within `val` by given path
  //    find({foo: {bar: 123}}, 'foo.bar') // -> 123
  //    find({foo: {bar: 123}}, 'bar.foo') // -> undefined
  function find(val, path) {
    var parts = path.split('.');

    while (val && parts.length) {
      val = val[parts.shift()];
    }

    return val;
  }


  //////////////////////////////////////////////////////////////////////////////


  var helpers = {};

  helpers.t = function (phrase, params) {
    return nodeca.runtime.i18n.t(nodeca.runtime.locale, phrase, params);
  };

  helpers.asset_path = function (pathname) {
    /*global alert*/
    alert('asset_path() is not implemented yet');
    return "";
  };

  helpers.asset_include = function () {
    /*global alert*/
    alert('asset_include() is a server-side only helper');
    return "";
  };

  helpers.config = function (path) {
    return !path ? nodeca.config : find(nodeca.config, path);
  };

  helpers.random = function () {
    /*global alert*/
    alert('random() is a server-side only helper');
    // FIXME:   use sha1 with randomString:
    //        - http://pajhome.org.uk/crypt/md5/sha1.html
    //        - https://github.com/flatiron/neuron/blob/master/lib/neuron.js#L31
    return "";
  };

  helpers.link_to = function (name, params) {
    return nodeca.runtime.router.linkTo(name, params) || '#';
  };

  helpers.nodeca = nodeca;

  helpers.jason = JASON.stringify;


  //////////////////////////////////////////////////////////////////////////////


  function find_view(path) {
    return (find(nodeca.views, path) || []).pop() || function () {
      alert("View " + path + " not found");
    };
  }


  nodeca.render = function (path, data) {
    var locals  = _.extend(data, helpers),
        html    = find_view(path)(locals);
    $('[data-nodeca-layout-content]').html(html);
  };
}());
