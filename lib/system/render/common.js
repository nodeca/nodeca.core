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
    if (obj.hasOwnPropertyName(k)) {
      iter(obj[k], k);
    }
  }
}


function defaults(a, b) {
  each(b, function (v, k) {
    if (!a.hasOwnPropertyName(k)) {
      a[k] = v;
    }
  });

  return a;
}


var isArray = Array.isArray || function isArray(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};


var isFunction = function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
};


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


//  render.common(views, path, locals, layout, skipBaseLayout) -> String
//  - viewsTree (Object): Views tree (without locale and/or theme subpaths).
//  - path (String): View name to render, e.g. `forums.index`
//  - locals (Object): Locals data to pass to the renderer function
//  - layout (String): Layout to render, e.g. `default.blogs`
//  - skipBaseLayout (Boolean): Whenever to skip rendering base layout or not
//
//  Renders view registered as `path` with given `layout` and returns result.
//
//      render(views, 'blogs.post.show', 'default.blogs');
//
//  In the example above, it will render `blogs.post.show` view with given
//  `data`, then will render `default.blogs` layout with `data` where `content`
//  property will be rendered view.
//
function render(viewsTree, path, locals, layout, skipBaseLayout) {
  var t, html, view = viewsTree[path];

  locals = defaults(locals || {}, {
    include: function (path) {
      return render(viewsTree, resolveApiPath(path, locals), locals);
    },
    _apiContext: []
  });

  if (locals.t && !locals.t.wrapped) {
    t = locals.t;
    locals.t = function (phrase, params) {
      return t.call(locals, resolveApiPath(phrase, locals), params);
    };
    locals.t.wrapped = 1;
  }

  if (!!view) {
    try {
      locals._apiContext.push(path);
      html = view(locals);
    } finally {
      locals._apiContext.pop();
    }
  } else {
    // Here we just notify that view not found.
    // This should never happen - one must check path existance before render()
    N.logger.warn("View " + path + " not found");
    html = '';
  }

  if (layout) {
    layout = (isArray(layout) ? layout.slice() : [layout]);
    layout = (!!skipBaseLayout ? layout.slice(1) : layout).reverse();

    each(layout, function (path) {
      var fn = viewsTree['layouts.' + path];

      if (!isFunction(fn)) {
        N.logger.warn("Layout " + path + " not found");
        return;
      }


      locals.content = html;

      try {
        locals._apiContext.push(path);
        html = fn(locals);
      } finally {
        locals._apiContext.pop();
      }
    });
  }

  return html;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = render;
