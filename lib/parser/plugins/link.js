// Link parser plugin
//

'use strict';


var _ = require('lodash');
var $ = require('../cheequery');
var mdurl = require('mdurl');
var punycode = require('punycode');


//////////////////////////////////////////////////////////////////////////
// Helpers
//
function elide_text(text, max) {
  var chars = punycode.ucs2.decode(text);

  if (chars.length >= max) {
    return punycode.ucs2.encode(chars.slice(0, max - 1)).replace(/…$/, '') + '…';
  }

  return text;
}

function text_length(text) {
  return punycode.ucs2.decode(text).length;
}


// Replace long parts of the urls with elisions.
//
// This algorithm is similar to one used in chromium:
// https://chromium.googlesource.com/chromium/src.git/+/master/chrome/browser/ui/elide_url.cc
//
//  1. Chop off path, e.g.
//  "/foo/bar/baz/quux" -> "/foo/bar/…/quux" -> "/foo/…/quux" -> "/…/quux"
//
//  2. Get rid of 2+ level subdomains, e.g.
//  "foo.bar.baz.x.com" -> "…bar.baz.x.com" -> "…baz.x.com" -> "…x.com"
//
//  3. Truncate the rest of the url
//
// If at any point of the time url becomes small enough, return it
//
function elide_url(url, max) {
  var url_str = mdurl.format(url);
  var query_length = ((url.search || '') + (url.hash || '')).length;

  // Maximum length of url without query+hash part
  //
  var max_path_length = max + query_length - 2;

  // Here and below this `if` condition means:
  //
  // Assume that we can safely truncate querystring at anytime without
  // readability loss up to "?".
  //
  // So if url without hash/search fits, return it, eliding the end
  // e.g. "example.org/path/file?q=12345" -> "example.org/path/file?q=12..."
  //
  if (text_length(url_str) <= max_path_length) { return elide_text(url_str, max); }

  // Try to elide path, e.g. "/foo/bar/baz/quux" -> "/foo/.../quux"
  //
  if (url.pathname) {
    var components = url.pathname.split('/');
    var filename = components.pop();

    if (filename === '' && components.length) {
      filename = components.pop() + '/';
    }

    while (components.length > 1) {
      components.pop();
      url.pathname = components.join('/') + '/…/' + filename;
      url_str = mdurl.format(url);

      if (text_length(url_str) <= max_path_length) { return elide_text(url_str, max); }
    }
  }

  // Elide subdomains up to 2nd level,
  // e.g. "foo.bar.example.org" -> "...bar.example.org",
  //
  if (url.hostname) {
    var subdomains = url.hostname.split('.');

    // If it starts with "www", just remove it
    //
    if (subdomains[0] === 'www' && subdomains.length > 2) {
      subdomains.shift();
      url.hostname = subdomains.join('.');
      url_str = mdurl.format(url);

      if (text_length(url_str) <= max_path_length) { return elide_text(url_str, max); }
    }

    while (subdomains.length > 2) {
      subdomains.shift();
      url.hostname = '…' + subdomains.join('.');
      url_str = mdurl.format(url);

      if (text_length(url_str) <= max_path_length) { return elide_text(url_str, max); }
    }
  }

  return elide_text(mdurl.format(url), max);
}


// Decode hostname/path and trim url
//  - url_str    - url to decode
//  - max_length - maximum allowed length for this url
//
function beautify_url(url_str, max_length) {
  var url = mdurl.parse(url_str, true);

  // urls without host and protocol, e.g. "example.org/foo"
  if (!url.protocol && !url.slashes && !url.hostname) {
    url = mdurl.parse('//' + url_str, true);
  }

  try {
    if (url.hostname) {
      url.hostname = punycode.toUnicode(url.hostname);
    }
  } catch (e) {}

  // Decode url-encoded characters
  //
  if (url.auth)     { url.auth     = mdurl.decode(url.auth); }
  if (url.hash)     { url.hash     = mdurl.decode(url.hash); }
  if (url.search)   { url.search   = mdurl.decode(url.search); }
  if (url.pathname) { url.pathname = mdurl.decode(url.pathname); }

  // Omit protocol if it's http, https or mailto
  //
  if (url.protocol && url.protocol.match(/^(https?|mailto):$/)) {
    url.protocol = null;
    url.slashes = null;
  } else if (url.slashes) {
    url.slashes = null;
  }

  return elide_url(url, max_length);
}


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

        if ($this.data('nd-auto') || $this.contents().length === 0) {
          replacement.append(beautify_url($this.attr('href'), 50));
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
  };
};
