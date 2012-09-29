'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global window, $, _, JASON, nodeca*/


////////////////////////////////////////////////////////////////////////////////


var tzOffset = (new Date).getTimezoneOffset();
var helpers  = {};


////////////////////////////////////////////////////////////////////////////////


helpers.t = nodeca.runtime.t;


helpers.date = function (value, format) {
  return nodeca.shared.common.date(value, format, nodeca.runtime.locale, tzOffset);
};

_.each(['asset_path', 'asset_include'], function (method) {
  helpers[method] = function () {
    throw method + '() is a server-side only helper, thus can be used in base layouts only.';
  };
});

helpers.link_to = function (name, params) {
  return nodeca.runtime.router.linkTo(name, params) || '#';
};

helpers.nodeca = function (path) {
  return !path ? nodeca : nodeca.shared.common.getByPath(nodeca, path);
};

// substitute JASON with JSON
helpers.jason = JSON.stringify;


////////////////////////////////////////////////////////////////////////////////


/**
 *  client.common.render.template(apiPath[, locals]) -> String
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *
 *  Renders view template.
 **/
module.exports.template = function template(apiPath, locals) {
  try {
    locals = _.extend(locals || {}, helpers, {runtime: nodeca.runtime});
    return nodeca.shared.common.render(nodeca.views, apiPath, locals, null, true);
  } catch (err) {
    nodeca.logger.error(
      'Failed render view <' + apiPath + '>:\n\n' +
      (err.stack || err.message || err)
    );
  }
};


/**
 *  client.common.render.page(apiPath[, locals[, layout][, callback]]) -> Void
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *  - layout (String): Layout or layouts stack
 *  - callback (Function): Executed once content was updated
 *
 *  Renders and updates page content.
 **/
module.exports.page = function page(apiPath, locals, layout, callback) {
  var $content = $('#content');

  if ('function' === typeof layout) {
    callback = layout;
    layout   = null;
  }

  callback = callback || $.noop;

  // make content semi-opaque before rendering
  $content.stop().fadeTo('fast', 0.3, function () {
    var html;

    try {
      locals = _.extend(locals || {}, helpers, {runtime: nodeca.runtime});
      html   = nodeca.shared.common.render(nodeca.views, apiPath, locals, layout, true);

      $content.html(html);
    } catch (err) {
      // FIXME: inject JS error into HTML if error occured?
      nodeca.logger.error(
        'Failed render view <' + apiPath +
        '> with layout <' + layout + '>:\n\n' +
        (err.stack || err.message || err)
      );
    }

    // inject statistical information
    nodeca.client.common.stats.inject(locals);

    // restore opacity
    $content.stop().fadeTo('fast', 1, function () {
      nodeca.client.common.floatbar.init();
    });

    callback();
  });
};
