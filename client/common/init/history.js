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


  // calls api3 method, and renders response
  //
  //    - data (Object) with `match`, `anchor` and `userClick` properties
  //    - href (String)
  function call_api3(data, href) {
    var match   = data.match,
        anchor  = data.anchor;

    $(window).scrollTop(0);

    nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
      // TODO: Properly handle `err` and (?) `msg.error`
      if (err) {
        nodeca.logger.error('Failed apiTree call', err);
        return;
      }

      try {
        nodeca.client.common.render(msg.view || match.meta, msg.layout, msg.data);
      } catch (err) {
        // FIXME: redirect on error? or at least propose user to click
        //        a link to reload to the requested page
        nodeca.logger.error('Failed render view <' + (msg.view || match.meta) +
                            '> with layout <' + msg.layout + '>', err);
        return;
      }

      document.title = msg.data.head.title;
      nodeca.client.common.navbar_menu.activate(msg.data.head.route || match.meta);

      if (data.userClick) {
        // **NOTICE** History.pushState(data, title, url):
        //            does not triggers event if url contains #
        History.pushState(data, null, href);
      }

      if (anchor) {
        // TODO: scrollTo()
        window.location.hash = anchor;
      }
    });
  }


  History.Adapter.bind(window, 'statechange', function (event) {
    var state = History.getState(), data = state.data || {};

    if (!data.userClick) {
      call_api3(state.data, state.url);
      return;
    }

    data.userClick = false;
  });


  $(function () {
    $('body').on('click', 'a', function (event) {
      var href  = $(this).attr('href').split('#'),
          match = href && nodeca.runtime.router.match(href[0]);

      // Continue as normal for cmd clicks etc
      if (2 === event.which || event.metaKey) {
        return true;
      }

      if (match) {
        call_api3({match: match, anchor: href[1]}, href[0]);
        event.preventDefault();
        return false;
      }
    });
  });
};
