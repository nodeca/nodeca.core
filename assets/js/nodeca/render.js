/**
 *  nodeca.render(view, data)
 *
 *  This module provides function for view rendering.
 **/


//= depend_on nodeca
//= require jade/runtime
//= require jason


/*global window, $, _, jade, JASON, nodeca*/


////////////////////////////////////////////////////////////////////////////////


var tzOffset = (new Date).getTimezoneOffset();


////////////////////////////////////////////////////////////////////////////////


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
    try {
      // TODO: should be removed once BabelFish is fixed
      return nodeca.runtime.i18n.t(nodeca.runtime.locale, phrase, params);
    } catch (err) {
      nodeca.logger.error('Failed translate phrase', phrase, params, err);
      return phrase;
    }
  };

  helpers.date = function (value, format) {
    return nodeca.shared.common.date(value, format, nodeca.runtime.locale, tzOffset);
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


  nodeca.render = function (path, layout, data) {
    var placeholder, $content_el, locals, html;

    // prepare variables
    placeholder = layout.split('.').shift(); // first part is a 'base layout'
    $content_el = $('[data-nodeca-layout-content="' + placeholder + '"]');
    layout      = nodeca.shared.common.render.parseLayout(layout).slice(1);

    if (!$content_el.length) {
      nodeca.logger.warn('Content placeholder <' + placeholder + '> is unknown');
      throw 'NODECA_PLACEHOLDER_NOT_FOUND';
    }

    locals  = _.extend(data, helpers);
    html    = nodeca.shared.common.render(nodeca.views, path, layout, locals);

    $content_el.html(html);
  };
}());
