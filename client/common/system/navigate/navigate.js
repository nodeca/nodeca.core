/* eslint no-alert: 0 */

'use strict';


var _ = require('lodash');
var StateMachine = require('javascript-state-machine');
var History = window.History; // History.js

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
    // replace state
    { name: 'replace',       from: 'IDLE',                  to: 'REPLACE' },
    // fake event to remove status check
    { name: 'terminate',     from: 'IDLE',                  to: 'IDLE' },

    // page data is in cache
    { name: 'complete',      from: 'BACK_FORWARD',          to: 'IDLE' },
    // load page data
    { name: 'loadingDone',   from: 'BACK_FORWARD',          to: 'BACK_FORWARD_COMPLETE' },

    // page loading complete, push history state
    { name: 'loadingDone',   from: 'LOAD',                  to: 'LOAD_COMPLETE' },
    // terminate page loading by back/forward buttons
    { name: 'stateChange',   from: 'LOAD',                  to: 'BACK_FORWARD' },
    // terminate page loading on error or if page is same
    { name: 'terminate',     from: 'LOAD',                  to: 'IDLE' },

    // handle push history state
    { name: 'stateChange',   from: 'LOAD_COMPLETE',         to: 'IDLE' },

    // loading complete, replace history state
    { name: 'stateChange',   from: 'BACK_FORWARD_COMPLETE', to: 'IDLE' },

    // handle replace history state
    { name: 'stateChange',   from: 'REPLACE',               to: 'IDLE' }
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
//
function parseOptions(options) {
  var match, href, anchor, apiPath, params, errorReport;

  if ('string' === typeof options) {
    options = { href: options };
  }

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
  if (anchor && '#' !== anchor.charAt(0)) {
    anchor = '#' + anchor;
  }

  return {
    apiPath: apiPath,
    params: params,
    href: href,
    anchor: anchor
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

    $('#content').replaceWith(content);

    if (scroll) {
      // Without this delay firefox at android fail to scroll on long pages
      setTimeout(function () {
        $(window).scrollTop((data.anchor && $(data.anchor).length) ? $(data.anchor).offset().top : 0);
      }, 50);
    }

    N.wire.emit([ 'navigate.done', 'navigate.done:' + data.apiPath ], data, function (err) {
      if (err) {
        N.logger.error('%s', err); // Log error, but not stop.
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
  var options = parseOptions(params);

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
  if (!History.enabled) {
    window.location = options.href + options.anchor;
    return;
  }

  // Stop here if base URL (all except anchor) haven't changed.
  if (options.href === (location.protocol + '//' + location.host + location.pathname)) {

    // Update anchor if it's changed.
    if (location.hash !== options.anchor) {
      location.hash = options.anchor;
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
    if ('string' === typeof result) {

      // Go back to `IDLE` and to `LOAD` again, otherwise `onLOAD` will not emitted
      fsm.terminate();
      fsm.link(result);
      return;
    }

    fsm.loadingDone(result, options);
  });
};

fsm.onLOAD_COMPLETE = function (event, from, to, result, options) {
  render(result, true, function () {
    History.pushState(result, result.locals.head.title, options.href);
  });
};

fsm.onBACK_FORWARD_COMPLETE = function (event, from, to, result, options) {
  render(result, false, function () {
    History.replaceState(result, result.locals.head.title, options.href);
  });
};

fsm.onBACK_FORWARD = function () {
  // stateChange terminate `LOAD` state, also remove old callback
  navigateCallback = null;

  var state = History.getState();

  if (!_.isEmpty(state.data)) {
    render(state.data, false, function () {
      fsm.complete();
    });
    return;
  }

  var options = parseOptions(state.url);

  // It's an external link or 404 error if route is not matched. So perform
  // regular page requesting via HTTP.
  if (!options.apiPath) {
    window.location = options.href + options.anchor;
    return;
  }

  loadData(options, function (result) {
    fsm.loadingDone(result, options);
  });
};

fsm.onREPLACE = function (event, from, to, data, title, url) {
  History.replaceState(data, title, url);
};


///////////////////////////////////////////////////////////////////////////////
// statechange handler

if (History.enabled) {
  History.Adapter.bind(window, 'statechange', function () {
    fsm.stateChange();
  });
}


///////////////////////////////////////////////////////////////////////////////
// Wire handlers

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


// Replace current History state without data fetching and rendering.
//
//   options.href  - full url of new history state.
//                   If not set - use current href. (optional)
//   options.title - new page title.
//                   If not set - use current title. (optional)
//   options.data  - data for history renderer; it will be used when user will
//                   return to this page using history navigation. (optional)
//
N.wire.on('navigate.replace', function navigate_replace(options, callback) {
  var state = History.getState();
  var url = options.href ? normalizeURL(options.href) : state.url;
  var title = options.title || state.title;
  var data = options.data || {};

  if (url !== state.url || title !== state.title || !_.isEqual(data, state.data)) {
    navigateCallback = callback;

    fsm.replace(data, title, url);
    return;
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
    if (2 === event.which || event.metaKey) {
      return;
    }

    if ('#' === $this.attr('href')) {
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
