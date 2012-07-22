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
  nodeca.io.init();

  $(function () {
    // Bootstrap.Collapse calls e.preventDefault() only when there's no
    // data-target attribute. We don't want URL to be changed, so we are
    // forcing prevention of default behavior.
    $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function ( e ) {
      e.preventDefault();
    });


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

    if (History.enabled) {
      $('body').on('click', 'a', function (event) {
        var href  = $(this).attr('href').split('#'),
            match = href && nodeca.runtime.router.match(href[0]);

        // Continue as normal for cmd clicks etc
        if (2 === event.which || event.metaKey) {
          return true;
        }

        if (match) {
          // **NOTICE** History.pushState(data, title, url):
          //            does not triggers event if url contains #
          History.pushState({match: match, anchor: href[1]}, null, href[0]);
          event.preventDefault();
          return false;
        }
      });

      History.Adapter.bind(window, 'statechange', function (event) {
        var state = History.getState(),
            data = state.data || {},
            match = data.match,
            anchor = data.anchor;

        document.title = 'Loading...';

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

          if (anchor) {
            // TODO: scrollTo()
            window.location.hash = anchor;
          }
        });
      });
    }
  });
};
