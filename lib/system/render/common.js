// common (shared between server and client renderers) ender method.


'use strict';


/*global N*/


////////////////////////////////////////////////////////////////////////////////


//
// THIS HELPERS ARE GOING TO BE REMOVED ONCE UNIVERSAL REQUIRE() WILL BE MAD
//


function each(obj, iter) {
  var k;

  for (k in obj) {
    if (obj.hasOwnProperty(k)) {
      iter(obj[k], k);
    }
  }
}


function defaults(a, b) {
  each(b, function (v, k) {
    if (!a.hasOwnProperty(k)) {
      a[k] = v;
    }
  });

  return a;
}


////////////////////////////////////////////////////////////////////////////////


// helper that normalizes (resolve) include/translate api paths
function resolveApiPath(path, locals) {
  var context = locals._apiContext[locals._apiContext.length - 1];

  if (0 === path.indexOf('@')) {
    return path.replace(/^@([^.]*)/, function (m, ns) {
      return ns || context.split('.').shift();
    });
  }

  return context + '.' + path;
}


////////////////////////////////////////////////////////////////////////////////


//  render.common(views, path, locals) -> String
//  - viewsTree (Object): Views tree (without locale and/or theme subpaths).
//  - path (String): View name to render, e.g. `forums.index`
//  - locals (Object): Locals data to pass to the renderer function
//
//  Renders a view registered as `path` and returns the result.
//
//  Example:
//
//      render(views, 'blogs.post.show', {title: 'Hello!', text: 'Foobar'});
//
function render(viewsTree, path, locals) {
  var t, html, view = viewsTree[path], layout;

  locals = defaults(locals || {}, {
    partial: function (path) {
      return render(viewsTree, resolveApiPath(path, locals), locals);
    },
    // contains stash of api paths. usually contains only one element:
    // apiPath being rendered. everytime include() being called or layout
    // being rendered their apiPath pushed into this stash and then poped out.
    // this is needed to allow us know base api path of view file that is
    // rendered.
    _apiContext: []
  });

  if (locals.t && !locals.t.wrapped) {
    t = locals.t;
    locals.t = function (phrase, params) {
      return t.call(locals, resolveApiPath(phrase, locals), params);
    };
    locals.t.wrapped = 1;
  }

  if (view) {
    locals._apiContext.push(path);

    try {
      html   = view(locals);  // Invoke a compiled render function.
      layout = locals.layout; // Get a layout setted by the render function.

      if (layout) {
        locals.layout  = null;
        locals.content = html; // Expose the resulting content to the layout.

        // Recursively render the layout.
        html = render(viewsTree, layout, locals);
      }
    } finally {
      locals._apiContext.pop();
    }
  } else {
    // Here we just notify that view not found.
    // This should never happen - one must check path existance before render()
    N.logger.warn("View %s not found", path);
    html = '';
  }

  return html;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = render;
