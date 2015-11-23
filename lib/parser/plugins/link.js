// Link parser plugin
//

'use strict';


var _        = require('lodash');
var $        = require('../cheequery');
var beautify = require('../beautify_url');


module.exports = function (N) {

  return function (parser) {
    var defaultRendererOpen = parser.md.renderer.rules.link_open || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    var defaultRendererClose = parser.md.renderer.rules.link_close || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    parser.md.renderer.rules.link_open = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-link';

      var href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

      if (N.router.match(href) !== null) {
        tokens[idx].attrPush([ 'data-nd-internal', true ]);
      }

      if (tokens[idx].info === 'auto') {
        tokens[idx].attrPush([ 'data-nd-auto', true ]);
      }

      return defaultRendererOpen(tokens, idx, options, env, _self);
    };

    parser.md.renderer.rules.link_close = function (tokens, idx, options, env, _self) {
      tokens[idx].tag = 'msg-link';

      return defaultRendererClose(tokens, idx, options, env, _self);
    };

    var intTpl = _.template('<a href="<%- href %>" class="link link-int<%- auto ? " link-auto" : "" %>"' +
                            ' title="<%- title %>"></a>');
    var extTpl = _.template('<a href="<%- href %>" class="link link-ext<%- auto ? " link-auto" : "" %>"' +
                            ' title="<%- title %>" target="_blank" rel="nofollow"></a>');

    // Add more classes, and target=_blank for external links
    //
    parser.bus.after('render', function render_links(data) {
      data.ast.find('msg-link').each(function () {
        var $this = $(this);

        // remove empty links like this: [](link)
        if ($this.contents().length === 0) {
          $this.remove();
        }

        var fn = ($this.data('nd-internal') ? intTpl : extTpl);
        var replacement = $(fn({
          href:  $this.attr('href'),
          title: $this.attr('title'),
          auto:  $this.data('nd-auto')
        }));

        if ($this.data('nd-auto')) {
          replacement.append(beautify($this.attr('href'), 50));
        } else {
          replacement.append($this.contents());
        }

        $this.replaceWith(replacement);
      });
    });

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
  };
};
