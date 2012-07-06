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


function get_layouts_stack(layout) {
  var stack = layout.split('.'), i, l;

  for (i = 1, l = stack.length; i < l; i++) {
    stack[i] = stack[i - 1] + '.' + stack[i];
  }

  return stack;
}


function prepare(locale, theme, path, layout) {
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
    var html = view(data);

    if (layout) {
      _.each(get_layouts_stack(layout).reverse(), function (path) {
        var fn = find_path(nodeca.runtime.views[locale][theme].layouts, path);

        if (!_.isFunction(fn)) {
          nodeca.logger.warn("Layout " + path + " not found");
          return;
        }

        data.content = html;
        html = fn(data);
      });
    }

    return html;
  };
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function render(locale, theme, path, layout, data) {
  return prepare(locale, theme, path, layout)(data);
};


module.exports.prepare = prepare;
