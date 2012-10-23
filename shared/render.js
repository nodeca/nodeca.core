'use strict';


/**
 *  shared
 **/


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


//  get_layout_stack(layout) -> Array
//  - layout (string): Full layout path
//
//  Returns stack of layouts.
//
//      get_layout_stack('foo.bar.baz') // => ['foo', 'foo.bar', 'foo.bar.baz']
//
function get_layout_stack(layout) {
  var stack = layout.split('.'), i, l;

  for (i = 1, l = stack.length; i < l; i++) {
    stack[i] = stack[i - 1] + '.' + stack[i];
  }

  return stack;
}


////////////////////////////////////////////////////////////////////////////////


/**
 *  shared.render(views, path, locals, layout, skipBaseLayout) -> String
 *  - viewsTree (Object): Views tree (without locale and/or theme subpaths).
 *  - path (String): View name to render, e.g. `forums.index`
 *  - locals (Object): Locals data to pass to the renderer function
 *  - layout (String): Layout to render, e.g. `default.blogs`
 *  - skipBaseLayout (Boolean): Whenever to skip rendering base layout or not
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
module.exports = function render(viewsTree, path, locals, layout, skipBaseLayout) {
  var html, stack, curr, view = nodeca.shared.getByPath(viewsTree, path);

  if (!!view) {
    html = view(locals);
  } else {
    nodeca.logger.warn("View <" + path + "> not found");
    throw new Error('View <' + path + '> not found.');
  }

  if (layout) {
    stack = (_.isArray(layout) ? layout.slice() : get_layout_stack(layout));

    if (!!skipBaseLayout) {
      // remove first (base) layout
      stack.shift();
    }

    while (stack.length) {
      curr = stack.shift();
      view = nodeca.shared.getByPath(viewsTree.layouts, curr);

      if (!_.isFunction(view)) {
        nodeca.logger.debug("Layout " + curr + " not found");
        continue;
      }

      locals.content = html;
      html = view(locals);
    }
  }

  return html;
};
