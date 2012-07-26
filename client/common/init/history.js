'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      $(nodeca.client.common.init);
 **/
module.exports = function () {
  var History = window.History; // History.js


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
  function find_match_data(url) {
    var parts   = String(url).split('#'),
        href    = String(parts[0]).replace(/^[^:]+:\/\//, '//'),
        anchor  = String(parts[1]),
        match   = nodeca.runtime.router.match(href);

    if (!match && /^\/\//.test(href)) {
      // try relative URL if full didn;t match
      //
      //    `//example.com/foo/bar` -> `/foo/bar`
      href  = href.replace(/^\/\/[^/]+\//, '/');
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
      if (err && err.statusCode && (301 === err.statusCode || 307 === err.statusCode)) {
        // handle rediect via RPC
        exec_api3_call(find_match_data(err.headers.Location), callback);
        return;
      }

      if (err && (err.statusCode || 'HTTP ONLY' === String(err))) {
        // can't deal via realtime - try http
        window.location = href;
        return;
      }

      // TODO: Properly handle `err` and (?) `msg.error`
      if (err) {
        nodeca.logger.error('Failed apiTree call', err);
        return;
      }

      callback({
        view:   msg.view || match.meta,
        layout: msg.layout,
        locals: msg.data,
        route:  msg.data.head.route || match.meta,
        anchor: anchor
      }, msg.data.head.title, href);
    });
  }

  //
  // Bind @statechange handler
  //

  History.Adapter.bind(window, 'statechange', function (event) {
    var data = History.getState().data, $el;

    if (!data || History.isEmptyObject(data)) {
      if (History.getStateByIndex(0).id === History.getState().id) {
        // First time got back to initial state - get necessary data
        var match = find_match_data(History.getState().url);

        // if router was able to find apropriate data - make a call,
        // otherwise should never happen
        if (match) {
          exec_api3_call(match, History.replaceState);
          return;
        }
      }

      // FIXME: handle this unexpected situation?
      return;
    }

    // make contnet semi-opque before rendering
    $('#content').stop().fadeTo('fast', 0.3, function () {
      try {
        nodeca.client.common.render(data.view, data.layout, data.locals);
        nodeca.client.common.navbar_menu.activate(data.route);
      } catch (err) {
        // FIXME: redirect on error? or at least propose user to click
        //        a link to reload to the requested page
        nodeca.logger.error('Failed render view <' + data.view +
                            '> with layout <' + data.layout + '>', err);
      }

      if (data.anchor) {
        // if anchor is given try to find matching element
        $el = $('#' + data.anchor);
      }

      if (!$el || !$el.length) {
        // if there were no anchor or thre were no matching element
        // use `top` element instead
        $el = $(document.body);
      }

      $el.ScrollTo({duration: 300});

      // restore opacity
      $('#content').stop().fadeTo('fast', 1);

      // remove "loading..." notification
      notification.hide();
    });
  });

  //
  // Bind global a.click handlers
  //

  $(function () {
    $('body').on('click', 'a', function (event) {
      var match = find_match_data($(this).attr('href'));

      // Continue as normal for cmd clicks etc
      if (2 === event.which || event.metaKey) {
        return true;
      }

      if (match) {
        exec_api3_call(match, History.pushState);
        event.preventDefault();
        return false;
      }
    });
  });
};
