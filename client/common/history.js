'use strict';


/*global NodecaLoader, N, window, document*/


var $       = window.jQuery;
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

    NodecaLoader.loadAssets((msg.view || match.meta).split('.').shift(), function () {
      callback({
        view:   msg.view || match.meta,
        layout: msg.layout,
        locals: msg.data,
        route:  msg.data.head.route || match.meta,
        anchor: anchor
      }, msg.data.head.title, href);
    });
  });
}

//
// Global semaphore that allows/dissalows ScrollTo animation.
// Animation is allowed every time we handle user click.
//

var allowScrollTo   = false;
var skipStateChange = false;


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
      , target = { apiPath: data.route, url: url }
      , $el;

    // trigger to skip common rendering when we have custom one
    // for example for "more ..." button
    if (skipStateChange) {
      skipStateChange = false;
      return;
    }

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

    N.wire.emit('navigate.exit', target, function () {
      $('#content').replaceWith(N.runtime.render(data.view, data.locals));

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

      N.wire.emit('navigate.done', target);
    });
  });

  //
  // Bind global a.click handlers
  //

  $(function () {
    $('body').on('click', 'a', function (event) {
      var $this = $(this), match;

      if (!!$this.attr('target') || event.isDefaultPrevented()) {
        // skip links that have `target` attribute specified
        // and clicks that were already handled
        return;
      }

      match = find_match_data($this.attr('href'));

      // Continue as normal for cmd clicks etc
      if (2 === event.which || event.metaKey) {
        return true;
      }

      if (match) {
        allowScrollTo = true;
        exec_api3_call(match, History.pushState);
        event.preventDefault();
        return false;
      }
    });
  });


  N.wire.on('history.update', function history_update(data) {
    skipStateChange = true;

    History.replaceState({
      view:   data.payload.view,
      layout: data.payload.layout,
      locals: data.payload.data,
      route:  data.payload.data.head.route
    }, data.payload.data.head.title, data.url || History.getState().url);
  });


  N.wire.on('navigate.to', function navigate_to(data) {
    allowScrollTo = true;

    exec_api3_call([
      { meta: data.apiPath, params: data.params },
      N.runtime.router.linkTo(data.apiPath, data.params),
      data.anchor
    ], History.pushState);
  });
}
