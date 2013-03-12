// Template renderer used by both the server and the client.


'use strict';


var _    = require('lodash');


////////////////////////////////////////////////////////////////////////////////


// Normalizes (resolves) include/translate API paths.
//
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


//  common.render(N, apiPath[, locals]]) -> String
//  - N (Object): The N global sandbox.
//  - apiPath (String): Template to render, e.g. `forum.index`
//  - locals (Object): Locals data to pass to the renderer function
//
//  Renders a template passing `locals` as `self` object within it.
//
module.exports = function render(N, apiPath, locals) {
  var templateFn
    , translateFn
    , result = '';

  if (N.views[apiPath]) {
    templateFn = N.views[apiPath];
  } else {
    throw new Error('View template "' + apiPath + '" not found.');
  }

  locals = _.defaults(locals || {}, {
    partial: function (partialPath) {
      return render(N, resolveApiPath(partialPath, locals), locals);
    }
    // contains stash of api paths. usually contains only one element:
    // apiPath being rendered. everytime include() being called or layout
    // being rendered their apiPath pushed into this stash and then poped out.
    // this is needed to allow us know base api path of view file that is
    // rendered.
  , _apiContext: []
  });

  if (locals.t && !locals.t.wrapped) {
    translateFn = locals.t;

    locals.t = function (phrase, params) {
      return translateFn.call(locals, resolveApiPath(phrase, locals), params);
    };

    locals.t.wrapped = true;
  }

  // Render the view.
  locals._apiContext.push(apiPath);

  try {
    result = templateFn(locals);
  } finally {
    locals._apiContext.pop();
  }

  return result;
};
