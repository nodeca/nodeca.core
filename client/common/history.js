'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.history
 **/


/*global $, _, nodeca, window, document*/


var History = window.History; // History.js


/**
 *  client.common.history.updateState(payload[, url]) -> Void
 *
 *  Proxy to History.js that replaces current State with new payload and URL.
 **/
module.exports.updateState = $.noop;


/**
 *  client.common.history.navigateTo(apiPath, params) -> Void
 *
 *  Perform server method, render result and update history.
 **/
module.exports.navigateTo = $.noop;


/**
 *  client.common.history.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.history.init();
 **/
module.exports.init = function () {
  if (!History.enabled) {
    // do not do anything if History.js is not available
    return;
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


  // An API object with show/hide methods
  //
  var notification = (function () {
    var timeout, msg = nodeca.runtime.t('common.notice.loading');

    return {
      show: function () {
        clearTimeout(timeout); // make sure previous timeout was cleared
        timeout = setTimeout(function () {
          nodeca.client.common.notice.show(msg);
        }, 500);
      },
      hide: function () {
        clearTimeout(timeout);
        nodeca.client.common.notice.hide();
      }
    };
  }());


  // Tries to find match data from the router
  //
  function find_match_data(url, anchor) {
    var parts   = String(url).split('#'),
        href    = String(parts[0]).replace(/^[^:]+:\/\//, '//'),
        match   = nodeca.runtime.router.match(href);

    // make sure anchor is an empty string or an id with hash prefix
    anchor = String(anchor || parts[1]).replace(/^#?(.*)/, '$1');

    if (!match && /^\/\//.test(href)) {
      // try relative URL if full didn;t match
      //
      //    `//example.com/foo/bar` -> `/foo/bar`
      href  = href.replace(/^\/\/[^\/]+\//, '/');
      match = nodeca.runtime.router.match(href);
    }

    return match ? [match, href, anchor] : null;
  }


  // Executes api3 method from given `data` (an array of `match`, `href` and
  // `anchor` as returned by find_match_data);
  //
  function exec_api3_call(data, callback) {
    var match = data[0], href = data[1], anchor = data[2];

    // schedule "loading..." notification
    notification.show();

    nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
      if (err && (301 === err.statusCode || 302 === err.statusCode || 307 === err.statusCode)) {
        // prepare new data
        data = find_match_data(err.headers.Location, window.location.hash);

        // handle redirect via RPC
        exec_api3_call(data, callback);
        return;
      }

      if (err) {
        // can't deal via rpc - try http
        window.location = href;
        return;
      }

      loadAssets((msg.view || match.meta).split('.').shift(), function () {
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

  History.Adapter.bind(window, 'statechange', function (event) {
    var data = History.getState().data, $el;

    // trigger to skip common rendering when we have custom one
    // for example for "more ..." button
    if (skipStateChange) {
      skipStateChange = false;
      return;
    }

    // we have no State data when it's an initial state or when it was removed
    // by `replaceStateURL`, so we schedule retreival of data by it's URL and
    // triggering this event once again (replaceState)
    if (!data || History.isEmptyObject(data)) {
      var match = find_match_data(History.getState().url);

      // if router was able to find apropriate data - make a call,
      // otherwise should never happen
      if (match) {
        exec_api3_call(match, History.replaceState);
      }

      return;
    }

    // make contnet semi-opque before rendering
    $('#content').stop().fadeTo('fast', 0.3, function () {
      var html;

      try {
        html = nodeca.client.common.render(data.view, data.locals, data.layout);
        $('#content').html(html);

        nodeca.client.common.navbar_menu.activate(data.route);
        nodeca.client.common.stats.inject(data.locals);
      } catch (err) {
        // error is logged by renderer
        allowScrollTo = false;
        notification.hide();

        // rethrow error
        throw err;
      }

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

        $("html:not(:animated)" + (!$.browser.opera ? ",body:not(:animated)" : ""))
          .animate({scrollTop: $el.position().top}, 300);

        // disable scrollTo
        allowScrollTo = false;
      }

      // restore opacity
      $('#content').stop().fadeTo('fast', 1, function () {
        nodeca.client.common.floatbar.init();
      });

      // remove "loading..." notification
      notification.hide();
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

  //
  // Provide real methods (as History.enabled)
  //

  module.exports.updateState = function updateState(payload, url) {
    skipStateChange = true;

    History.replaceState({
      view:   payload.view,
      layout: payload.layout,
      locals: payload.data,
      route:  payload.data.head.route
    }, payload.data.head.title, url || History.getState().url);
  };


  module.exports.navigateTo = function navigateTo(apiPath, params) {
    exec_api3_call([
      { meta: apiPath, params: params },
      nodeca.runtime.router.linkTo(apiPath, params),
      null
    ], History.pushState);
  };
};
