'use strict';


/**
 *  shared
 **/

/**
 *  shared.common
 **/


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


// see [[shared.common.render.getLayoutStack]]
function get_layout_stack(layout) {
  var stack = layout.split('.'), i, l;

  for (i = 1, l = stack.length; i < l; i++) {
    stack[i] = stack[i - 1] + '.' + stack[i];
  }

  return stack;
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
 *      render(views, 'blogs.post.show', 'default.blogs');
 *
 *  In the example above, it will render `blogs.post.show` view with given
 *  `data`, then will render `default.blogs` layout with `data` where `content`
 *  property will be rendered view, then `default` layout with `data` where
 *  `content` property will be previously rendered layout.
 **/
module.exports = function render(views, path, layout, data) {
  var view = nodeca.shared.common.getByPath(views, path),
      html = view && view(data) || '';

  if (!view) {
    // Here we just notify that view not found.
    // This should never happen - one must check path existance before render()
    nodeca.logger.warn("View " + path + " not found");
  }

  if (layout) {
    layout = (_.isArray(layout) ? layout.slice() : get_layout_stack(layout));
    _.each(layout.reverse(), function (path) {
      var fn = nodeca.shared.common.getByPath(views.layouts, path);

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


/**
 *  shared.common.render.getLayoutStack(layout) -> Array
 *  - layout (string): Full layout path
 *
 *  Returns stack of layouts.
 *
 *      getLayoutStack('foo.bar.baz') // => ['foo', 'foo.bar', 'foo.bar.baz']
 **/
module.exports.getLayoutStack = get_layout_stack;
