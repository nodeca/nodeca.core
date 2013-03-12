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
 *  client.render(N, apiPath[, locals]) -> String
 *  - N (Object): The N global sandbox.
 *  - apiPath (String): Server method API path.
 *  - locals (Object): Locals data for the renderer
 *
 *  Renders a view at the given `apiPath`.
 **/
module.exports = function (N, apiPath, locals) {
  locals = _.extend(locals || {}, {
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

  return render(N, apiPath, locals);
};
