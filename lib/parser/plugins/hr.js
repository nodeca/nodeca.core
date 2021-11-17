// HR parser plugin
//
'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.enable('hr');

    ///////////////////////////////////////////////////////////////////////////
    // Block code to AST
    //
    let defaultRenderer = parser.md.renderer.rules.hr || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    parser.md.renderer.rules.hr = function (tokens, idx, options, env, _self) {
      tokens[idx].attrPush([ 'data-nd-hr-src', tokens[idx].markup ]);

      return defaultRenderer(tokens, idx, options, env, _self);
    };

    ///////////////////////////////////////////////////////////////////////////
    // Remove hr
    //
    parser.bus.on('ast2preview', function remove_hr(data) {
      data.ast.find('hr').remove();
    });
  };
};
