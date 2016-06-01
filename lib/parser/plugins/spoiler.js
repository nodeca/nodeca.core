// Spoiler parser plugin
//
'use strict';


const _ = require('lodash');
const $ = require('../cheequery');


module.exports = function () {

  function render_spoiler(tokens, idx, options, env, _self) {
    tokens[idx].tag = 'msg-spoiler';

    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush([ 'data-nd-title', tokens[idx].info.replace(/^spoiler/, '').trim() ]);
    }

    return _self.renderToken(tokens, idx, options, env, _self);
  }

  return function (parser) {
    var renderTpl = _.template(
      '<div class="spoiler">' +
        '<div class="spoiler__title">' +
          '<span class="spoiler__icon-collapse icon icon-collapse-alt icon-space-after"></span>' +
          '<span class="spoiler__icon-expand icon icon-expand-alt icon-space-after"></span>' +
          '<%- title %>' +
        '</div>' +
        '<div class="spoiler__inner">' +
          '<div class="spoiler__content"></div>' +
        '</div>' +
      '</div>'
    );

    parser.md.use(require('markdown-it-container'), 'spoiler', {
      marker: '`',
      render: render_spoiler
    });

    parser.bus.on('ast2html', function render_spoiler(data) {
      data.ast.find('msg-spoiler').each(function () {
        var element     = $(this);
        var replacement = $(renderTpl({
          title: element.attr('data-nd-title')
        }));

        // Move all child elements from <spoiler> to <div class="spoiler">.
        //
        // Note: we can't clone them (e.g. insert in the template above)
        // because the `each` loop won't traverse new elements, thus
        // nested spoilers will not work.
        //
        replacement.children().children('.spoiler__content').append(element.contents());
        element.replaceWith(replacement);
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Replace spoiler to it's content
    //
    parser.bus.before('ast2preview', function replace_spoiler(data) {
      data.ast.find('msg-spoiler').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });
  };
};
