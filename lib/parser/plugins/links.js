// Links parser plugin
//

'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function (N) {

  return function (parser) {
    var defaultRenderer = parser.md.renderer.rules.link_open || function (tokens, idx, options, env, _self) {
      return _self.renderToken(tokens, idx, options);
    };

    parser.md.renderer.rules.link_open = function (tokens, idx, options, env, _self) {
      var href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

      if (N.router.match(href) !== null) {
        tokens[idx].attrPush([ 'data-nd-internal', true ]);
      }

      if (tokens[idx].info === 'auto') {
        tokens[idx].attrPush([ 'data-nd-auto', true ]);
      }

      return defaultRenderer(tokens, idx, options, env, _self);
    };

    var intTpl = _.template('<a href="<%- href %>" class="link link-int<%- auto ? " link-auto" : "" %>"' +
                            ' title="<%- title %>"></a>');
    var extTpl = _.template('<a href="<%- href %>" class="link link-ext<%- auto ? " link-auto" : "" %>"' +
                            ' title="<%- title %>" target="_blank" rel="nofollow"></a>');

    // Add "link" class to all links in the document, assuming that those tags
    // could only come from markdown links at this point.
    //
    parser.bus.before('render', { priority: -100 }, function add_link_class(data) {
      data.ast.find('a').addClass('link');
    });


    // Add more classes, and target=_blank for external links
    //
    parser.bus.on('render', function render_links(data) {
      data.ast.find('.link').each(function () {
        var $this = $(this);
        var fn = ($this.data('nd-internal') ? intTpl : extTpl);
        var replacement = $(fn({
          href:  $this.attr('href'),
          title: $this.attr('title'),
          auto:  $this.data('nd-auto')
        }));

        replacement.append($this.contents());
        $this.replaceWith(replacement);
      });
    });

    parser.md.enable([
      'link',
      'autolink',
      'linkify'
    ]);

    parser.md.set({
      linkify: true
    });
  };
};
