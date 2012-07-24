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


  History.Adapter.bind(window, 'statechange', function (event) {
    var data = History.getState().data;

    // FIXME: load appropriate data for initial state, as it's data is null

    $(window).scrollTop(0);

    try {
      nodeca.client.common.render(data.view, data.layout, data.locals);
    } catch (err) {
      // FIXME: redirect on error? or at least propose user to click
      //        a link to reload to the requested page
      nodeca.logger.error('Failed render view <' + data.view +
                          '> with layout <' + data.layout + '>', err);
      return;
    }

    document.title = data.title;
    nodeca.client.common.navbar_menu.activate(data.route);

    // TODO: listen statechange and anchorchange events
    //       we can't use:
    //
    //          window.location.hash = data.anchor;
    //
    //       as it adds new state and triggers `anchorchange`
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
        nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
          // TODO: Properly handle `err` and (?) `msg.error`
          if (err) {
            nodeca.logger.error('Failed apiTree call', err);
            return;
          }

          // **NOTICE** History.pushState(data, title, url):
          //            does not triggers event if url contains #
          History.pushState({
            view:   msg.view || match.meta,
            layout: msg.layout,
            locals: msg.data,
            title:  msg.data.head.title,
            route:  msg.data.head.route || match.meta
          }, null, href[0]);
        });

        event.preventDefault();
        return false;
      }
    });
  });
};
