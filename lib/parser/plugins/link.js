// Link parser plugin
//
'use strict';


const _         = require('lodash');
const $         = require('../cheequery');
const beautify  = require('../beautify_url');
const utils     = require('../utils');
const charcount = require('charcount');


module.exports = function (N) {

  return function (parser) {
    ///////////////////////////////////////////////////////////////////////////
    // Links to AST
    //
    parser.md.enable([
      'link',
      'reference',
      'autolink',
      'linkify'
    ]);

    parser.md.set({
      linkify: true
    });

    parser.md.linkify.set({
      fuzzyIP: false,
      fuzzyLink: false
    });

    // Don't detect links without protocol - too many false positives.
    parser.md.linkify.add('//', null);

    let defaultRendererOpen = parser.md.renderer.rules.link_open || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    let defaultRendererClose = parser.md.renderer.rules.link_close || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    parser.md.renderer.rules.link_open = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-link';

      let href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

      if (N.router.match(href) !== null) {
        tokens[idx].attrPush([ 'data-nd-internal', true ]);
      }

      if (tokens[idx].info === 'auto') {
        tokens[idx].attrPush([ 'data-nd-auto', true ]);
      }

      if (tokens[idx].markup) {
        tokens[idx].attrPush([ 'data-nd-link-type', tokens[idx].markup ]);
      }

      tokens[idx].attrPush([ 'data-nd-link-orig', href ]);

      return defaultRendererOpen(tokens, idx, options, env, _self);
    };

    parser.md.renderer.rules.link_close = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-link';

      return defaultRendererClose(tokens, idx, options, env, _self);
    };


    ///////////////////////////////////////////////////////////////////////////
    // Links to HTML
    //
    const intTpl = _.template(`
      <a href="<%- href %>"
         class="link link-int<%- auto ? " link-auto" : "" %>"
         <% if (title) { %>
           title="<%- title %>"
         <% } %>
         <% if (type) { %>
           data-nd-link-type="<%- type %>"
         <% } %>
         data-nd-link-orig="<%- orig %>"
      ></a>
    `.replace(/\n\s*/g, ''));

    const extTpl = _.template(`
      <a href="<%- href %>"
         class="link link-ext<%- auto ? " link-auto" : "" %>"
         <% if (title) { %>
           title="<%- title %>"
         <% } %>
         <% if (type) { %>
           data-nd-link-type="<%- type %>"
         <% } %>
         data-nd-link-orig="<%- orig %>"
         target="_blank" rel="nofollow noopener"
      ></a>
    `.replace(/\n\s*/g, ''));


    // Add more classes, and target=_blank for external links
    //
    function render_links(data) {
      data.ast.find('msg-link').each(function () {
        let $this = $(this);

        // remove empty links like this: [](link)
        if ($this.contents().length === 0) {
          $this.remove();
        }

        let fn = ($this.data('nd-internal') ? intTpl : extTpl);
        let replacement = $(fn({
          href:  $this.attr('href'),
          title: $this.attr('title'),
          auto:  $this.data('nd-auto'),
          type:  $this.data('nd-link-type'),
          orig:  $this.data('nd-link-orig')
        }));

        if ($this.data('nd-auto')) {
          replacement.append(beautify($this.attr('href'), 50));
        } else {
          replacement.append($this.contents());
        }

        $this.replaceWith(replacement);
      });
    }

    parser.bus.after('ast2html', render_links);


    ///////////////////////////////////////////////////////////////////////////
    // Links to preview
    //
    parser.bus.on('ast2preview', function replace_link(data) {
      // Replace link to text if `link2text`
      if (data.params.link2text) {
        data.ast.find('msg-link').each(function () {
          let $el = $(this);
          let $replacement = $('<span class="preview-link"></span>');

          if ($el.data('nd-auto')) {
            $replacement.append(beautify($el.attr('href'), 50));
          } else {
            $replacement.append($el.contents());
          }

          $el.replaceWith($replacement);
        });
      } else {
        render_links(data);
      }
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    // - href length for auto links (limit 50 symbols)
    // - text nodes length for normal links
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('msg-link').each(function () {
        let $el = $(this);

        if ($el.data('nd-auto')) {
          data.result.text_length += Math.min(charcount($el.attr('href').replace(/\s+/g, '')), 50);
        } else {
          data.result.text_length += utils.text_length($el);
        }
      });
    });
  };
};
