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


//  client.common.render(apiPath[, locals[, layout]]) -> Void
//  - apiPath (String): Server method API path.
//  - locals (Object): Locals data for the renderer
//  - layout (String): Layout or layouts stack
//
//  Renders view.
//
function render(apiPath, locals, layout) {
  if (!nodeca.shared.common.getByPath(nodeca.views, apiPath)) {
    nodeca.logger.error('View <' + apiPath + '> not found.');
    throw new Error('View <' + apiPath + '> not found.');
  }

  try {
    locals = _.extend(locals || {}, helpers, {runtime: nodeca.runtime});
    return nodeca.shared.common.render(nodeca.views, apiPath, locals, layout, true);
  } catch (err) {
    nodeca.logger.error(
      'Failed render view <' + apiPath + '>' +
      (layout ? (' with layout <' + layout + '>') : '') +
      ':\n\n' + (err.stack || err.message || err)
    );
  }
}


/**
 *  client.common.render.template(apiPath[, locals]) -> String
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *
 *  Renders view template.
 **/
module.exports.template = function template(apiPath, locals) {
  return render(apiPath, locals);
};


/**
 *  client.common.render.page(apiPath[, locals[, layout][, callback]]) -> Void
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *  - layout (String): Layout or layouts stack
 *  - callback (Function): Executed once content was updated
 *
 *  Renders view.
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
    // FIXME: inject JS error into HTML if error occured?
    $content.html(render(apiPath, locals, layout));

    // inject statistical information
    nodeca.client.common.stats.inject(locals);

    // restore opacity
    $content.stop().fadeTo('fast', 1, function () {
      nodeca.client.common.floatbar.init();
    });

    callback();
  });
};
