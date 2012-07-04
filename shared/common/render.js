'use strict';


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


function find_path(obj, path) {
  var parts = path.split('.');

  // this is the fastest way to find nested value:
  // http://jsperf.com/find-object-deep-nested-value

  while (obj && parts.length) {
    obj = obj[parts.shift()];
  }

  return obj;
}


function get_layouts_stack(theme, layout) {
  var stack = [],
      parts = (layout || '').split('.'),
      func;

  // TODO: In-memory caching

  _.each((layout || '').split('.'), function (part, idx, parts) {
    var path = parts.slice(0, idx + 1).join('.');

    theme = theme && theme[part];

    if (!theme) {
      nodeca.logger.warn("Layout " + path + " not found");
      return;
    }

    if (!_.isFunction(theme)) {
      nodeca.logger.warn("Layout " + path + " is not a function");
      return;
    }

    stack.push(theme);
  });

  return stack;
}


function prepare(locale, theme, path, layouts) {
  var view;

  if (!nodeca.runtime.views[locale]) {
    throw new Error("No localized views for " + locale);
  }

  if (!nodeca.runtime.views[locale][theme]) {
    throw new Error("Theme " + theme + " not found");
  }

  view = find_path(nodeca.runtime.views[locale][theme], path);

  if (!view) {
    throw new Error("View " + path + " not found");
  }

  return function (data) {
    var // body is a simple string
        // head is a list of strings like `<link href=...` and so on
        out = {body: view(data), head: []};

    if (layouts && layouts.length) {
      _.each(layouts.slice().reverse(), function (path) {
        var fn = find_path(nodeca.runtime.views[locale][theme].layouts, path);

        if (!_.isFunction(fn)) {
          nodeca.logger.warn("Layout " + path + " not found");
          return;
        }

        data.content = out.body;
        out.body = fn(data);
      });
    }

    // TODO: fill in out.head

    return out;
  };
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function render(locale, theme, path, layouts, data) {
  return prepare(locale, theme, path, layouts)(data);
};


module.exports.prepare = prepare;
