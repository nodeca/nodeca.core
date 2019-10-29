// Cut parser plugin
//

'use strict';


var md_cut = require('./lib/md-cut');


module.exports = function () {
  function render_cut(tokens, idx, options, env, _self) {
    tokens[idx].tag = 'msg-cut';
    return _self.renderToken(tokens, idx, options, env, _self);
  }

  return function (parser) {
    parser.md.use(md_cut, {
      render: render_cut
    });
  };
};
