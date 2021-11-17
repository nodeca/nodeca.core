// Emphasis parser plugin
//
'use strict';


const $     = require('../cheequery');
const utils = require('../utils');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'emphasis', 'strikethrough' ]);

    ///////////////////////////////////////////////////////////////////////////
    // Block code to AST
    //
    let defaultRendererStrongOpen =
      parser.md.renderer.rules.strong_open || function (tokens, idx, options, env, _self) {
        return _self.renderToken(tokens, idx, options);
      };

    parser.md.renderer.rules.strong_open = function (tokens, idx, options, env, _self) {
      tokens[idx].attrPush([ 'data-nd-pair-src', tokens[idx].markup ]);

      return defaultRendererStrongOpen(tokens, idx, options, env, _self);
    };


    let defaultRendererEmOpen =
      parser.md.renderer.rules.em_open || function (tokens, idx, options, env, _self) {
        return _self.renderToken(tokens, idx, options);
      };

    parser.md.renderer.rules.em_open = function (tokens, idx, options, env, _self) {
      tokens[idx].attrPush([ 'data-nd-pair-src', tokens[idx].markup ]);

      return defaultRendererEmOpen(tokens, idx, options, env, _self);
    };


    ///////////////////////////////////////////////////////////////////////////
    // Emphasis to preview
    //
    parser.bus.on('ast2preview', function replace_emphasis(data) {
      data.ast.find('strong, em, s').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('strong, em, s').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
