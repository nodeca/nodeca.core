// Footnote parser plugin
//
'use strict';


const $ = require('../cheequery');
const _ = require('lodash');


module.exports = function () {

  return function (parser) {
    parser.md.use(require('markdown-it-footnote'));


    ///////////////////////////////////////////////////////////////////////////
    // Footnote to AST
    //
    parser.md.renderer.rules.footnote_open = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-footnote-data';
      tokens[idx].attrPush([ 'data-nd-footnote-id', tokens[idx].meta.id ]);

      return _self.renderToken(tokens, idx, options);
    };


    parser.md.renderer.rules.footnote_close = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-footnote-data';

      return _self.renderToken(tokens, idx, options);
    };


    parser.md.renderer.rules.footnote_ref = function (tokens, idx) {
      let id = tokens[idx].meta.id;
      let sub = tokens[idx].meta.subId;

      return `<msg-footnote-ref data-nd-footnote-id="${id}" data-nd-footnote-sub-id="${sub}"></msg-footnote-ref>`;
    };


    parser.md.renderer.rules.footnote_block_open   = () => '';
    parser.md.renderer.rules.footnote_block_close  = () => '';
    parser.md.renderer.rules.footnote_anchor       = () => '';


    ///////////////////////////////////////////////////////////////////////////
    // Render footnote to HTML
    //
    const footnote_ref_tpl = _.template(
      '<sup class="footnote-ref">' +
      '<a href="#<%= prefix %>fn<%= n %>" id="<%= prefix %>fnref<%= n %>' +
      '<% if (sub) { print(":" + sub); } %>">[<%= n %>]</a>' +
      '</sup>'
    );
    const footnotes_list_tpl = _.template(
      '<hr class="footnotes-sep">\n' +
      '<section class="footnotes">\n' +
      '<ol class="footnotes-list">\n' +
      '<% Object.entries(items).forEach(function (arr) { var id = arr[0], html = arr[1] ; %>' +
      '<li id="<%= prefix %>fn<%= Number(id) + 1 %>" class="footnote-item">' +
      '<%= html %>' +
      '</li>\n<% }); %>' +
      '</ol>\n' +
      '</section>'
    );
    const back_ref_tpl = _.template(
      ' <a href="#<%= prefix %>fnref<%= n %>' +
      '<% if (sub) { print(":" + sub); } %>" class="footnote-backref">\u21a9</a>' /* ↩ */
    );


    parser.bus.on('ast2html', function render_footnote(data) {

      // Replace refs
      //
      let sub_count = {};

      data.ast.find('msg-footnote-ref').each(function () {
        let $el = $(this);
        let id = $el.data('nd-footnote-id');

        sub_count[id] = sub_count[id] || 0;
        sub_count[id]++;

        $el.replaceWith(footnote_ref_tpl({
          n: Number(id) + 1,
          sub: Number($el.data('nd-footnote-sub-id')),
          prefix: data.footnote_prefix
        }));
      });


      // Replace definitions
      //
      let items = {};

      data.ast.find('msg-footnote-data').each(function () {
        let $el = $(this);
        let id = $el.data('nd-footnote-id');
        let $last = $el.children().last();
        let back_refs = '';

        for (let i = 0; i < sub_count[id]; i++) {
          back_refs += back_ref_tpl({ n: Number(id) + 1, sub: i, prefix: data.footnote_prefix });
        }

        if ($last.prop('tagName') === 'P') {
          $last.append(back_refs);
        } else {
          $el.append(back_refs);
        }

        items[id] = $el.html();

        $el.remove();
      });


      // Append footnotes to tail of AST
      //
      if (Object.keys(items).length) {
        data.ast.append(footnotes_list_tpl({ items, prefix: data.footnote_prefix }));
      }
    });


    ///////////////////////////////////////////////////////////////////////////
    // Remove footnotes
    //
    parser.bus.before('ast2preview', function remove_footnotes(data) {
      data.ast.find('msg-footnote-data, msg-footnote-ref').remove();
    });
  };
};
