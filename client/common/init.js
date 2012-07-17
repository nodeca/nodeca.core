'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca, window*/


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
  //
  // Observe quicksearch focus to tweak icon style
  //
  $('.navbar-search .search-query')
    .focus(function (){ $(this).next('div').addClass('focused'); })
    .blur(function (){ $(this).next('div').removeClass('focused'); });


  //
  // Observe clicks on anchors
  //

  var History = window.History; // History.js

  function call_api3(href, match) {
    nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
      // TODO: Properly handle `err` and (?) `msg.error`
      if (err) {
        nodeca.logger.error('Failed apiTree call', err);
        return;
      }

      try {
        nodeca.render(msg.view || match.meta, msg.layout, msg.data);
      } catch (err) {
        if ('NODECA_PLACEHOLDER_NOT_FOUND' === err) {
          window.location = href;
          return;
        }

        // FIXME: redirect on error? or at least propose user to click
        //        a link to reload to the requested page
        nodeca.logger.error('Failed render view <' + (msg.view || match.meta) +
                            '> with layout <' + msg.layout + '>', err);
        return;
      }

      History.pushState(match, msg.data.head.title, href);
      nodeca.client.common.navbar_menu.activate(msg.data.head.route || match.meta);
    });
  }

  if (History.enabled) {
    $('body').on('click', 'a', function (event) {
      var href  = $(this).attr('href'),
          match = href && nodeca.runtime.router.match(href.split('#')[0]);

      if (match) {
        call_api3(href, match);
        event.preventDefault();
        return false;
      }
    });

    History.Adapter.bind(window, 'statechange', function (event) {
      console.log(History.getState(), event);
    });
  }
};
