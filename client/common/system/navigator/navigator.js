'use strict';


var History = window.History; // History.js


// Returns normalized URL:
//
//  http://example.com/foo.html  => http://example.com/foo.html
//  /foo.html                    => http://example.com/foo.html
//  //example.com/foo.html       => http://example.com/foo.html
//
function normalizeURL(url) {
  var a = document.createElement('a');
  a.href = url;
  return a.href.toString();
}


// ## WARNING ############################################################# //
//                                                                          //
// History.js works poorly with URLs containing hashes:                     //
//                                                                          //
//    https://github.com/balupton/history.js/issues/111                     //
//    https://github.com/balupton/history.js/issues/173                     //
//                                                                          //
// So upon clicks on `/foo#bar` we treat URL and push it to the state as    //
// `/foo` and saving `bar` in the state data, so we could scroll to desired //
// element upon statechange                                                 //
//                                                                          //
// ######################################################################## //


// Tries to find match data from the router
//
function find_match_data(url, anchor) {
  var parts   = String(url).split('#'),
      href    = String(parts[0]),
      match   = N.runtime.router.match(href);

  // make sure anchor is an empty string or an id with hash prefix
  anchor = String(anchor || parts[1] || '').replace(/^#?(.*)/, '$1');

  return match ? [match, href, anchor] : null;
}


// Executes api3 method from given `data` (an array of `match`, `href` and
// `anchor` as returned by find_match_data);
//
// `callback` is a History function `pushState` or `replaceState`
//
function exec_api3_call(data, callback) {
  var match = data[0], href = data[1], anchor = data[2];

  N.io.rpc(match.meta, match.params, function (err, msg) {
    if (err && (N.io.REDIRECT === err.code)) {
      // note, that we try to keep anchor, if exists.
      // that's important for moved threads & last pages redirects

      // prepare new data
      data = find_match_data(err.head.Location, anchor || window.location.hash);

      // handle redirect via RPC
      exec_api3_call(data, callback);
      return;
    }

    if (err && (N.io.ECONNECTION === err.code)) {
      // No need to do anything.
      // User already notified that he needs to try again later
      return;
    }

    if (err) {
      // can't deal via rpc - try http. This might be:
      //
      // - either a generic error, e.g. authorization / bad params / fuckup
      //   so we redirect user to show him an error page
      //
      // - or version mismatch,
      //   so we call action by HTTP to update client
      window.location = href;
      return;
    }

    if (msg.layout !== N.runtime.layout) {
      // Layout was changed - perform normal page loading.
      //
      // TODO: Prevent double page requesting. The server should not perform
      // database queries on RPC when the client is not intending to use the
      // response data. Like in this situation.
      window.location = href;
      return;
    }

    // History.JS does not plays well with full URLs but without protocols:
    //
    //  http://example.com/foo.html  -- OK
    //  /foo.html                    -- OK
    //  //example.com/foo.html       -- becomes /example.com/foo.html
    //
    // So we normalie URL to be full one (with protocol, host, etc.)
    href = normalizeURL(href);

    N.loader.loadAssets((msg.view || match.meta).split('.').shift(), function () {
      callback({
        apiPath: msg.apiPath || match.meta
      , view:    msg.view    || match.meta
      , layout:  msg.layout
      , locals:  msg.data
      , anchor:  anchor
      }, msg.data.head.title, href);
    });
  });
}

// Global semaphore that allows/dissalows ScrollTo animation.
// Animation is allowed every time we handle user click.
var allowScrollTo   = false;


// Global semaphore that allows/disallows render new #content block
// when walking over pages using RPC.
var skipRender = false;


if (History.enabled) {
  //
  // Bind @statechange handler.
  // This handler is called when:
  //
  //   - user presses `back` or `forward` button in his browser
  //   - user clicks a link
  //   - user clicks "more ..." button
  //
  // Automates content rendering from State data for common cases.
  //
  History.Adapter.bind(window, 'statechange', function (/* event */) {
    var state  = History.getState()
      , data   = state.data
      , url    = state.url
      , target = { apiPath: data.apiPath, url: url }
      , $el;

    // we have no State data when it's an initial state, so we schedule
    // retreival of data by it's URL and triggering this event once
    // again (via History.replaceState)
    if (!data || History.isEmptyObject(data)) {
      var match = find_match_data(url);

      // if router was able to find apropriate data - make a call,
      // otherwise should never happen
      if (match) {
        exec_api3_call(match, History.replaceState);
      }

      return;
    }

    N.wire.emit('navigate.exit', target, function (err) {
      var content;

      if (err) {
        N.logger.error('%s', err);
      }

      if (!skipRender) {
        content = $(N.runtime.render(data.view, data.locals, { apiPath: data.apiPath })).hide();

        $('#content').fadeOut('fast', function () {
          $(this).replaceWith(content);
          content.fadeIn('fast');

          N.wire.emit('navigate.done', target, function (err) {
            if (err) {
              N.logger.error('%s', err);
            }
          });

          // scroll to element only when we handle user click
          if (allowScrollTo) {
            // if anchor is given try to find matching element
            if (data.anchor) {
              $el = $(data.anchor);
            }

            // if there were no anchor or thre were no matching element
            // use `top` element instead
            if (!$el || !$el.length) {
              $el = $(document.body);
            }

            // FIXME: This may not work for Opera. Should check it on jQuery 1.9
            $("html:not(:animated)").animate({scrollTop: $el.position().top}, 300);

            // disable scrollTo
            allowScrollTo = false;
          }
        });
      }

      // To make Back button work properly.
      skipRender = false;
    });
  });
}


// Performes navigation to the given page. `data` may be either a string (href)
// and an object with keys:
//
//    data.href
//    data.apiPath
//    data.params
//    data.replaceState
//    data.skipRender
//
// `href` and `apiPath` parameters are mutually exclusive.
//
N.wire.on('navigate.to', function navigate_to(data, callback) {
  var match, href, anchor, apiPath, params;

  if ('string' === typeof data) {
    data = { href: data };
  }

  if (data.href) {
    match = find_match_data(data.href);

    if (!match) {
      callback(new Error('Cannot match route ' + data.href));
      return;
    }

    apiPath = match[0].meta;
    params  = match[0].params || {};
    href    = match[1];
    anchor  = match[2];

  } else if (data.apiPath) {
    apiPath = data.apiPath;
    params  = data.params || {};
    href    = N.runtime.router.linkTo(apiPath, params);
    anchor  = '';

    if (!href) {
      callback(new Error('Cannot build URL for API path "' + apiPath + '"'));
      return;
    }

  } else {
    callback(new Error('Need "href" or "apiPath" parameters to handle ' +
                       '"navigate.to" event.'));
    return;
  }

  if (History.enabled) {
    exec_api3_call(
      [ { meta: apiPath, params: params }, href, anchor ]
    , function (stateData, stateTitle, stateHref) {
        // NOTE: These are module-wide variables.
        allowScrollTo = true;
        skipRender    = data.skipRender || false;

        if (data.replaceState) {
          History.replaceState(stateData, stateTitle, stateHref);
        } else {
          History.pushState(stateData, stateTitle, stateHref);
        }

        callback();
      }
    );
  } else {
    // Fallback for old browsers.
    window.location = href;
  }
});

//
// Bind global a.click handlers
//

N.wire.once('navigate.done', { priority: 999 }, function () {
  $('body').on('click', 'a', function (event) {
    var $this = $(this), match;

    if ($this.attr('target') || event.isDefaultPrevented()) {
      // skip links that have `target` attribute specified
      // and clicks that were already handled
      return;
    }

    if ($this.data('target')) {
      // Skip links handled by Bootstrap plugins.
      // TODO: Probably we should find more convenient way for this.
      return;
    }

    match = find_match_data($this.attr('href'));

    // Continue as normal for cmd clicks etc
    if (2 === event.which || event.metaKey) {
      return true;
    }

    if (match) {
      allowScrollTo = true;
      skipRender = false;
      exec_api3_call(match, History.pushState);
      event.preventDefault();
      return false;
    }
  });
});
