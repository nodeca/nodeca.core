// client-side renderer. Contains local helpers etc and calls common render
// method internally.


'use strict';


/**
 *  client
 **/


var _      = require('lodash');
var render = require('./common');
var date   = require('../date');


////////////////////////////////////////////////////////////////////////////////


var tzOffset = (new Date).getTimezoneOffset();


////////////////////////////////////////////////////////////////////////////////


/**
 *  client.render(N, apiPath[, locals[, helpers]]) -> String
 *  - N (Object): The N global sandbox.
 *  - apiPath (String): Template to render, e.g. `forum.index`
 *  - locals (Object): Locals data to pass to the renderer function
 *  - helpers (Object): Helper functions and constants
 *
 *  Renders a template passing `locals` and `helpers` as `self` object within
 *  it. The difference between these is that `locals` is only for the specified
 *  template, but `helpers` passes forward to partials.
 **/
module.exports = function (N, apiPath, locals, helpers) {
  helpers = _.extend((helpers ? _.clone(helpers) : {}), {
    t: N.runtime.t

  , date: function (value, format) {
      return date(value, format, N.runtime.locale, tzOffset);
    }

  , asset_include: function () {
      N.logger.error('asset_include() is a server-side only helper, ' +
                     'thus can be used in base layouts only.');
      return '';
    }

  , link_to: function (name, params) {
      return N.runtime.router.linkTo(name, params) || '#';
    }
  });

  return render(N, apiPath, locals, helpers);
};
