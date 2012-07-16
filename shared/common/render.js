'use strict';


/**
 *  shared
 **/

/**
 *  shared.common
 **/


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


// returns deep-nested value from the obj by path
//
//    find_path({foo: {bar: 123}}, 'foo.bar'); // => 123
//
function find_path(obj, path) {
  var parts = path.split('.');

  // this is the fastest way to find nested value:
  // http://jsperf.com/find-object-deep-nested-value

  while (obj && parts.length) {
    obj = obj[parts.shift()];
  }

  return obj;
}


// return stack of layouts
//
//    get_layouts_stack('foo.bar'); // => ['foo', 'foo.bar']
//
function get_layouts_stack(layout) {
  var stack = layout.split('.'), i, l;

  for (i = 1, l = stack.length; i < l; i++) {
    stack[i] = stack[i - 1] + '.' + stack[i];
  }

  return stack;
}


// prepares renderer function that will render view by given path with all
// layouts required
function prepare(views, path, layout) {
  var view = find_path(views, path);

  if (!view) {
    throw new Error("View " + path + " not found");
  }

  return function (data) {
    var html = view(data);

    if (layout) {
      _.each(get_layouts_stack(layout).reverse(), function (path) {
        var fn = find_path(views.layouts, path);

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


/**
 *  shared.common.render(views, path, layout, data) -> String
 *  - views (Object): Views tree (without locale and/or theme subpaths).
 *  - path (String): View name to render, e.g. `forums.index`
 *  - layout (String): Layout to render, e.g. `default.blogs`
 *  - data (Object): Locals data to pass to the renderer function
 *
 *  Renders view registered as `path` with given `layout` and returns result.
 *
 *
 *  ##### See Also:
 *
 *  - [[shared.common.render.prepare]]
 **/
module.exports = function render(views, path, layout, data) {
  return prepare(views, path, layout)(data);
};


/**
 *  shared.common.render.prepare(views, path, layout) -> Function
 *  - views (Object): Views tree (without locale and/or theme subpaths).
 *  - path (String): View name to render, e.g. `forums.index`
 *  - layout (String): Layout to render, e.g. `default.blogs`
 *
 *  Returns renderer `function (data)` that will render view registered in
 *  `views` as `path` and then will render all requested layouts:
 *
 *      var func = prepare(views, 'blogs.post.show', 'default.blogs');
 *
 *  In the example above, `func(data)` will render `blogs.post.show` view with
 *  given `data`, then will render `default.blogs` layout with `data` where
 *  `content` property will be rendered view, then `default` layout with `data`
 *  where `content` property will be previously rendered layout.
 **/
module.exports.prepare = prepare;
