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

    if (data.anchor) {
      $.noop();
      // TODO: Scroll to desired element
    }
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
            route:  msg.data.head.route || match.meta,
            anchor: href[1]
          }, null, href[0]);
        });

        event.preventDefault();
        return false;
      }
    });
  });
};
