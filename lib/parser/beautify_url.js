// Decode url and collapse its long parts
//
'use strict';


const mdurl     = require('mdurl');
const punycode  = require('punycode');
const charcount = require('charcount');


function elide_text(text, max) {
  if (text.length <= max) return text;

  let regexp = new RegExp('^((?:[\uD800-\uDBFF][\uDC00-\uDFFF]|.){' + Number(max) + '}).');
  let m = text.match(regexp);

  if (!m) return text;

  return m[1].replace(/…*$/, '…');
}


// Replace long parts of the urls with elisions.
//
// This algorithm is similar to one used in chromium:
// https://chromium.googlesource.com/chromium/src.git/+/master/chrome/browser/ui/elide_url.cc
//
//  1. Chop off path, e.g.
//
//     "/foo/bar/baz/quux" -> "/foo/bar/…/quux" -> "/foo/…/quux" -> "/…/quux"
//
//  2. Get rid of 2+ level subdomains, e.g.
//
//     "foo.bar.baz.example.com" -> "…bar.baz.example.com" ->
//     "…baz.example.com" -> "…example.com"
//
//     Exception 1: if 2nd level domain is 1-3 letters, truncate to 3rd level:
//
//     "foo.bar.baz.co.uk" -> ... -> "…baz.co.uk"
//
//     Exception 2: don't change if it is 3rd level domain which has short (1-4 characters) 3rd level
//
//     "foo.example.org" -> "foo.example.org"
//     "bar.foo.example.org" -> "…example.org"
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
  if (charcount(url_str) <= max_path_length) { return elide_text(url_str, max); }

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

      if (charcount(url_str) <= max_path_length) { return elide_text(url_str, max); }
    }
  }

  // Elide subdomains up to 2nd level,
  // e.g. "foo.bar.example.org" -> "...bar.example.org",
  //
  // Do NOT elide IP addresses here
  //
  if (url.hostname && !url.hostname.match(/\.\d+$/)) {
    var subdomains = url.hostname.split('.');
    var was_elided = false;

    // If it starts with "www", just remove it
    //
    if (subdomains[0] === 'www' && subdomains.length > 2) {
      subdomains.shift();
      url.hostname = subdomains.join('.');
      url_str = mdurl.format(url);

      if (charcount(url_str) <= max_path_length) return elide_text(url_str, max);
    }

    for (;;) {
      // truncate up to 2nd level domain, e.g. `example.com`
      if (subdomains.length <= 2) break;

      // if 2nd level is short enough, truncate up to 3rd level, e.g. `example.co.uk`
      // (ideally, we'd use https://publicsuffix.org/list/public_suffix_list.dat,
      // but the list is too large)
      if (subdomains.length === 3 && subdomains[1].length < 3) break;

      // if 3rd level is short enough (1-4 characters), keep it as is
      if (!was_elided && subdomains.length === 3 && subdomains[0].length <= 4) break;

      subdomains.shift();
      url.hostname = '…' + subdomains.join('.');
      url_str = mdurl.format(url);
      was_elided = true;

      if (charcount(url_str) <= max_path_length) return elide_text(url_str, max);
    }
  }

  return elide_text(mdurl.format(url), max);
}


// Decode hostname/path and trim url
//  - url_str    - url to decode
//  - max_length - maximum allowed length for this url
//
function beautify_url(url_str, max_length) {
  if (typeof url_str === 'undefined' || url_str === null) return '';

  var url = mdurl.parse(String(url_str), true);

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
  if (url.auth)     url.auth     = mdurl.decode(url.auth);
  if (url.hash)     url.hash     = mdurl.decode(url.hash);
  if (url.search)   url.search   = mdurl.decode(url.search);
  if (url.pathname) url.pathname = mdurl.decode(url.pathname);

  // Remove trailing slash: http://example.org/ → http://example.org
  //
  if (url.pathname === '/' && !url.search && !url.hash) url.pathname = '';

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


module.exports = beautify_url;
