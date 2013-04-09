'use strict';


// ## NOTE ################################################################ //
//                                                                          //
// History.js works poorly with URLs containing hashes:                     //
//                                                                          //
//    https://github.com/browserstate/history.js/issues/111                 //
//    https://github.com/browserstate/history.js/issues/173                 //
//                                                                          //
// So upon clicks on `/foo#bar` we treat URL and push it to the state as    //
// `/foo` and saving `bar` in the state data, so we could scroll to desired //
// element upon statechange                                                 //
//                                                                          //
// ######################################################################## //


var History = window.History; // History.js


// Returns a normalized URL:
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


// Returns a normalized options object for `navigate.to` wire handler:
//
//    options.href
//    options.apiPath
//    options.params
//    options.history - optional function; default is `History.pushState`
//    options.render  - optional function; default is `navigationRender`
//
// `href` and `apiPath` parameters are calculated from each other.
// So they are mutually exclusive.
//
function normalizeOptions(options) {
  var match, href, anchor, apiPath, params;

  if ('string' === typeof options) {
    options = { href: options };
  }

  if (options.href) {
    match = N.runtime.router.match(options.href);

    if (!match) {
      throw new Error('Cannot match route ' + options.href);
    }

    apiPath = match.meta;
    params  = match.params || {};
    href    = options.href.split('#')[0];
    anchor  = options.href.split('#')[1] || '';

  } else if (options.apiPath) {
    apiPath = options.apiPath;
    params  = options.params || {};
    href    = N.runtime.router.linkTo(apiPath, params);
    anchor  = options.anchor || '';

    if (!href) {
      throw new Error('Cannot build URL for API path "' + apiPath + '"');
    }

    // Drop hash-prefix if exists.
    // Needed when we take the anchor from `window.location.hash`.
    if ('#' === anchor.charAt(0)) {
      anchor = anchor.slice(1);
    }

  } else {
    throw new Error('Need "href" or "apiPath" parameters to handle ' +
                    '"navigate.to" event.');
  }

  // History.JS does not plays well with full URLs but without protocols:
  //
  //  http://example.com/foo.html  -- OK
  //  /foo.html                    -- OK
  //  //example.com/foo.html       -- becomes /example.com/foo.html
  //
  // So we normalize URL to be full one (with protocol, host, etc.)
  return {
    href:    normalizeURL(anchor ? (href + '#' + anchor) : href)
  , anchor:  anchor
  , apiPath: apiPath
  , params:  params
  , render:  options.render
  , history: options.history
  };
}


// Default renderer for `navigate.to` event.
// Used to render content when user clicks a link.
//
function navigationRender(data, callback) {
  var content = $(N.runtime.render(data.view, data.locals, {
    apiPath: data.apiPath
  })).hide();

  $('#content').fadeOut('fast', function () {
    $(this).replaceWith(content);
    content.fadeIn('fast');

    $('html:not(:animated)').animate({
      scrollTop: data.anchor ? ($('#' + data.anchor).position().top) : 0
    }, 300);

    callback();
  });
}


// Used to render content when user presses Back/Forward buttons.
//
function historyRender(data, callback) {
  var content = $(N.runtime.render(data.view, data.locals, {
    apiPath: data.apiPath
  })).hide();

  $('#content').fadeOut('fast', function () {
    $(this).replaceWith(content);
    content.fadeIn('fast');
    callback();
  });
}


// Reference a function to be used on next fire of history 'statechange' event
// to perform content injection/replacement.
//
// NOTE: The event handler *always* resets this variable to `historyRender`
// after each call.
var __renderCallback__ = historyRender;


N.wire.on('navigate.to', function navigate_to(options, callback) {
  try {
    options = normalizeOptions(options);
  } catch (err) {
    callback(err);
    return;
  }

  // Fallback for old browsers.
  if (!History.enabled) {
    window.location = options.href;
    callback();
    return;
  }

  N.io.rpc(options.apiPath, options.params, function (err, response) {
    if (err && N.io.REDIRECT === err.code) {
      // Note, that we try to keep anchor, if exists.
      // That's important for moved threads and last pages redirects.
      N.wire.emit('navigate.to', {
        urlPath: err.head.Location
      , anchor:  options.anchor || window.location.hash
      , render:  options.render
      , history: options.history
      }, callback);
      return;
    }

    if (err && N.io.ECONNECTION === err.code) {
      // No need to do anything.
      // User already notified that he needs to try again later.
      callback(err);
      return;
    }

    if (err) {
      // Can't deal via RPC - try HTTP. This might be:
      //
      // - Either a generic error, e.g. authorization / bad params / fuckup
      //   so we redirect user to show him an error page.
      //
      // - Version mismatch, so we call action by HTTP to update client.
      window.location = options.href;
      callback();
      return;
    }

    if (response.layout !== N.runtime.layout) {
      // Layout was changed - perform normal page loading.
      //
      // TODO: Prevent double page requesting. The server should not perform
      // database queries on RPC when the client is not intending to use the
      // response data. Like in this situation.
      window.location = options.href;
      callback();
      return;
    }

    N.loader.loadAssets((response.view || options.apiPath).split('.')[0], function () {
      var state = {
        apiPath: options.apiPath
      , anchor:  options.anchor
      , view:    response.view   || options.apiPath
      , layout:  response.layout || null
      , locals:  response.data   || {}
      };

      __renderCallback__ = options.render || navigationRender;
      (options.history || History.pushState)(state, response.data.head.title, options.href);
      callback();
    });
  });
});

//
// Bind History's statechange handler. It fires when:
//
// - User presses `Back` or `Forward` button in his browser.
// - User clicks a link.
// - User clicks "More threads/posts/etc" button.
//

if (History.enabled) {
  History.Adapter.bind(window, 'statechange', function () {
    var state  = History.getState()
      , target = { apiPath: state.data.apiPath, url: state.url };

    // We have no state data when it's an initial state, so we schedule
    // retrieval of data by it's URL and triggering this event once
    // again (via History.replaceState).
    if (!state.data || History.isEmptyObject(state.data)) {
      N.wire.emit('navigate.to', {
        href:    state.url
      , history: History.replaceState
      });
      return;
    }

    N.wire.emit('navigate.exit', target, function (err) {
      if (err) {
        N.logger.error('%s', err);
      }

      __renderCallback__(state.data, function () {
        N.wire.emit('navigate.done', target, function (err) {
          if (err) {
            N.logger.error('%s', err);
          }

          // Reset to default. It's needed to ensure using right renderer on
          // regular history state changes - when user clicks back/forward
          // buttons in his browser.
          __renderCallback__ = historyRender;
        });
      });
    });
  });
}

//
// Bind global a.click handler.
//

N.wire.once('navigate.done', { priority: 999 }, function () {
  $('body').on('click', 'a', function (event) {
    var $this = $(this);

    if ($this.attr('target') || event.isDefaultPrevented()) {
      // skip links that have `target` attribute specified
      // and clicks that were already handled
      return false;
    }

    if ($this.data('target')) {
      // Skip links handled by Bootstrap plugins.
      // TODO: Probably we should find more convenient way for this.
      return false;
    }

    // Continue as normal for cmd clicks etc
    if (2 === event.which || event.metaKey) {
      return true;
    }

    N.wire.emit('navigate.to', $this.attr('href'), function (err) {
      if (err) {
        N.logger.error('%s', err);
      }
    });

    return false;
  });
});
