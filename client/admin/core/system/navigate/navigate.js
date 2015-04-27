/* eslint no-alert: 0 */

'use strict';


var _ = require('lodash');
var StateMachine = require('javascript-state-machine');
var History = window.history;

var lastPageData;
var navigateCallback;
// Incremented request ID
var requestID = 0;

var fsm = StateMachine.create({
  initial: 'IDLE',

  error: function (eventName, from, to, args, errorCode, errorMessage) {
    var errorReport = 'Navigator error: ' + errorMessage;

    window.alert(errorReport);
    return errorReport;
  },

  events: [
    // back/forward buttons
    { name: 'stateChange',   from: 'IDLE',                  to: 'BACK_FORWARD' },
    // link click
    { name: 'link',          from: 'IDLE',                  to: 'LOAD' },
    // fake event to remove status check
    { name: 'terminate',     from: 'IDLE',                  to: 'IDLE' },

    // page data is in cache
    { name: 'complete',      from: 'BACK_FORWARD',          to: 'IDLE' },
    // page loading complete
    { name: 'complete',      from: 'LOAD',                  to: 'IDLE' },

    // terminate page loading by back/forward buttons
    { name: 'stateChange',   from: 'LOAD',                  to: 'BACK_FORWARD' },
    // terminate page loading on error or if page is same
    { name: 'terminate',     from: 'LOAD',                  to: 'IDLE' },

    // handle pop history state on anchor change
    { name: 'changeHash',    from: 'LOAD',                  to: 'HASH_CHANGE' },
    // anchor change complete
    { name: 'stateChange',   from: 'HASH_CHANGE',           to: 'IDLE' }
  ]
});


///////////////////////////////////////////////////////////////////////////////
// Local functions

function normalizeURL(url) {
  var a = document.createElement('a');
  a.href = url;
  return a.href.toString();
}


// Parse navigation options
//
// - options
//   - href (required if `apiPath` is not set)
//   - apiPath (required if `href` is not set)
//   - params
//   - anchor
//   - force (reloads the page even if new url matches the old one)
//
// `force` flag is internal, consider using `navigate.reload` in other modules instead
//
function parseOptions(options) {
  var match, href, anchor, apiPath, params, errorReport, force;

  if (typeof options === 'string') {
    options = { href: options };
  }

  force = !!options.force;

  if (options.href) {
    href = normalizeURL(options.href).split('#')[0];
    anchor = normalizeURL(options.href).slice(href.length) || '';

    match = _.find(N.router.matchAll(href), function (match) {
      return _.has(match.meta.methods, 'get');
    });

    if (match) {
      apiPath = match.meta.methods.get;
      params = match.params || {};
    }

  } else if (options.apiPath) {
    apiPath = options.apiPath;
    params = options.params || {};
    href = normalizeURL(N.router.linkTo(apiPath, params));
    anchor = options.anchor || '';

    if (!href) {
      errorReport = 'Invalid parameters passed to `navigate.to` event: ' +
                    JSON.stringify(options);

      window.alert(errorReport);
      return null;
    }

  } else {
    errorReport = 'Not enough parameters for `navigate.to` event. ' +
                  'Need `href` or `apiPath` at least: ' +
                  JSON.stringify(options);

    window.alert(errorReport);
    return null;
  }

  // Add anchor hash-prefix if not exists.
  if (anchor && anchor.charAt(0) !== '#') {
    anchor = '#' + anchor;
  }

  return {
    apiPath: apiPath,
    params: params,
    href: href,
    anchor: anchor,
    force: force
  };
}


function loadData(options, callback) {
  var id = ++requestID;

  // History is enabled - try RPC navigation.
  N.io.rpc(options.apiPath, options.params, { handleAllErrors: true }, function (err, res) {

    // Page loading is terminated
    if (id !== requestID) {
      callback(null);
      return;
    }

    if (err && N.io.REDIRECT === err.code) {
      var redirectUrl = document.createElement('a');

      // Tricky way to parse URL.
      redirectUrl.href = err.head.Location;

      // Note, that we try to keep anchor, if exists.
      // That's important for moved threads and last pages redirects.
      var hash = options.anchor || window.location.hash;

      // Skip on empty hash to avoid dummy '#' in link
      if (hash) {
        redirectUrl.hash = hash;
      }

      // If protocol is changed, we must completely reload the page to keep
      // Same-origin policy for RPC.
      // - port check not required, because port depends on protocol.
      // - domain check not required, because RPC is available on all domains
      //   (it uses relative path)
      if (redirectUrl.protocol !== location.protocol) {
        window.location = redirectUrl.href;
      } else {
        callback(redirectUrl.href);
      }
      return;
    }

    if (err && N.io.INVALID_CSRF_TOKEN === err.code) {
      // We are here if CSRF token is incorrect AND rpc call failed to
      // auto-refresh it. It could happen if cookies are disabled.
      //
      // In this case we fallback to navigation via page reload to make
      // site work somehow.
      //
      // If cookies are disabled, user will see a warning about it on
      // the next page anyway.
      //
      window.location = options.href + options.anchor;
      return;
    }

    if (err) {
      // Can't load via RPC - show error page.
      //
      // This is a generic error, e.g. forbidden / not found / client error.

      callback({
        apiPath: 'common.error',
        params: {},
        anchor: '',
        view: 'common.error',
        locals: {
          err: err,
          head: { title: err.code + ' ' + err.message }
        }
      });
      return;
    }

    N.loader.loadAssets(options.apiPath.split('.')[0], function () {

      // Page loading is terminated
      if (id !== requestID) {
        callback(null);
        return;
      }

      var state = {
        apiPath: options.apiPath,
        params: options.params,
        anchor: options.anchor,
        view: options.apiPath,
        locals: res || {}
      };

      callback(state);
    });
  });
}


function render(data, scroll, callback) {

  N.wire.emit([ 'navigate.exit:' + lastPageData.apiPath, 'navigate.exit' ], lastPageData, function (err) {
    if (err) {
      N.logger.error('%s', err); // Log error, but not stop.
    }

    N.runtime.page_data = {};

    var content = $(N.runtime.render(data.view, data.locals, {
      apiPath: data.apiPath
    }));

    document.title = data.locals.head.title;

    $('#content').replaceWith(content);

    N.wire.emit([ 'navigate.done', 'navigate.done:' + data.apiPath ], data, function (err) {
      if (err) {
        N.logger.error('%s', err); // Log error, but not stop.
      }

      if (scroll && !data.no_scroll) {
        // Without this delay firefox on android fails to scroll on long pages
        setTimeout(function () {
          $(window).scrollTop((data.anchor && $(data.anchor).length) ? $(data.anchor).offset().top : 0);
        }, 50);
      }

      if (callback) {
        callback();
      }
    });
  });
}


///////////////////////////////////////////////////////////////////////////////
// FSM handlers

fsm.onIDLE = function () {
  if (navigateCallback) {
    navigateCallback();
    navigateCallback = null;
  }
};

fsm.onLOAD = function (event, from, to, params) {
  var options = parseOptions(params),
      same_url = (options.href === (location.protocol + '//' + location.host + location.pathname));

  // If errors while parsing
  if (!options) {
    fsm.terminate();
    return;
  }

  // It's an external link or 404 error if route is not matched. So perform
  // regular page requesting via HTTP.
  if (!options.apiPath) {
    window.location = options.href + options.anchor;
    return;
  }

  // Fallback for old browsers.
  if (!History || !History.pushState) {
    window.location = options.href + options.anchor;
    return;
  }

  // Stop here if base URL (all except anchor) haven't changed.

  if (same_url && !options.force) {

    // Update anchor if it's changed.
    if (location.hash !== options.anchor) {

      fsm.changeHash();
      location.hash = options.anchor;
      return;
    }


    fsm.terminate();
    return;
  }

  loadData(options, function (result) {
    // Loading terminated
    if (result === null || !fsm.is('LOAD')) {
      return;
    }

    // Redirect url
    if (typeof result === 'string') {

      // Go back to `IDLE` and to `LOAD` again, otherwise `onLOAD` will not emitted
      fsm.terminate();
      fsm.link(result);
      return;
    }

    render(result, true, function () {
      if (same_url) {
        History.replaceState(null, result.locals.head.title, options.href + options.anchor);
      } else {
        History.pushState(null, result.locals.head.title, options.href + options.anchor);
      }
      fsm.complete();
    });
  });
};

fsm.onBACK_FORWARD = function () {
  // stateChange terminate `LOAD` state, also remove old callback
  navigateCallback = null;

  var options = parseOptions(document.location);

  // It's an external link or 404 error if route is not matched. So perform
  // regular page requesting via HTTP.
  if (!options.apiPath) {
    window.location = options.href + options.anchor;
    return;
  }

  loadData(options, function (result) {
    render(result, false, function () {
      History.replaceState(null, result.locals.head.title, options.href + options.anchor);
      fsm.complete();
    });
  });
};


///////////////////////////////////////////////////////////////////////////////
// statechange handler

if (History && History.pushState) {
  window.addEventListener('popstate', function () {
    fsm.stateChange();
  });
}


///////////////////////////////////////////////////////////////////////////////
// Wire handlers


// Get current page data from local cache or from server
//
// params:
// - data - (output) current page data
//
N.wire.on('navigate.get_page_raw', function get_page_raw(params, callback) {

  // All needed data already loaded
  if (lastPageData.locals) {
    params.data = lastPageData.locals;
    callback();
    return;
  }

  // We should load data from server
  N.io.rpc(lastPageData.apiPath, lastPageData.params).done(function (data) {
    // Save response in local cache
    lastPageData.locals = data;

    params.data = lastPageData.locals;
    callback();
  });
});


// Performs RPC navigation to the specified page. Allowed options:
//
//    options.href
//    options.apiPath
//    options.params
//
// `href` and `apiPath` parameters are calculated from each other.
// So they are mutually exclusive.
//
N.wire.on('navigate.to', function navigate_to(options, callback) {
  fsm.terminate();

  navigateCallback = callback;
  fsm.link(options);
});


// Reload current page.
//
N.wire.on('navigate.reload', function navigate_reload(__, callback) {
  fsm.terminate();

  navigateCallback = callback;
  fsm.link({ href: location.href, force: true });
});


// Replace current History state without data fetching and rendering.
//
//   options.href  - full url of new history state.
//                   If not set - use current href. (optional)
//   options.title - new page title.
//                   If not set - use current title. (optional)
//
N.wire.on('navigate.replace', function navigate_replace(options, callback) {
  var url = options.href ? normalizeURL(options.href) : normalizeURL(location.href);
  var title = options.title || document.title;

  if (document.title !== title || normalizeURL(location.href) !== url) {
    History.replaceState(null, title, url);
    document.title = title;
  }

  callback();
});


N.wire.on('navigate.done', { priority: -999 }, function apipath_set(data) {
  lastPageData = data;
});


N.wire.once('navigate.done', { priority: 999 }, function navigate_click_handler() {
  $(document).on('click', 'a', function (event) {
    var $this = $(this);

    if ($this.attr('target') || event.isDefaultPrevented()) {
      // skip links that have `target` attribute specified
      // and clicks that were already handled
      return;
    }

    // Continue as normal for cmd clicks etc
    if (event.which === 2 || event.metaKey) {
      return;
    }

    if ($this.attr('href') === '#') {
      // Prevent clicks on special "button"-links.
      event.preventDefault();
      return;
    }

    N.wire.emit('navigate.to', $this.attr('href'), function (err) {
      if (err) {
        N.logger.error('%s', err);
      }
    });

    event.preventDefault();
  });
});
